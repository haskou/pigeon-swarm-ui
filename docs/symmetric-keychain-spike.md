# Symmetric keychain spike

## Scope

Spike para mover el cifrado de contenido desde claves asimetricas por conversacion/comunidad hacia claves simetricas, manteniendo la asimetria solo para compartir claves.

Tambien se actualiza `@haskou/value-objects` de `2.7.4` a `2.10.0`, que expone `SymmetricKey` y `SymmetricEncryptedPayload`.

## Estado actual

La keychain local la decide frontend porque su contenido se cifra antes de publicarse:

```ts
type LocalKeychain = {
  conversations: Record<string, ConversationKeyEntry>;
  version: number;
};
```

Cada entrada actual es asimetrica:

```ts
type ConversationKeyEntry = {
  conversationId: string;
  createdAt: number;
  peerIdentityId: string;
  privateKey: string;
  publicKey: string;
};
```

Backend solo ve el envelope de publicacion de keychain:

```ts
{
  encryptedPayload,
  previousKeychainExternalIdentifier,
  signature,
  timestamp,
  version,
}
```

Por tanto, backend no puede validar ni interpretar la estructura interna de `LocalKeychain`.

Las comunidades privadas usan la misma estructura: `session.keychain.conversations[community.id]`. Es decir, ahora una comunidad privada es tecnicamente otra entrada de `ConversationKeyEntry` guardada bajo el id de la comunidad.

## API disponible en `@haskou/value-objects@2.10.0`

`SymmetricKey` soporta:

- `SymmetricKey.generate()`
- `SymmetricKey.fromBase64(key)`
- `SymmetricKey.fromBuffer(buffer)`
- `SymmetricKey.fromPassword(password, { salt, N?, r?, p? })`
- `SymmetricKey.fromPasswordUsingOwasp(password, { salt })`
- `key.encrypt(payload, { aad? })`
- `key.decrypt(encryptedPayload, { aad? })`

Detalles relevantes:

- Algoritmo: `aes-256-gcm`.
- IV: 12 bytes.
- Key: 32 bytes.
- Payload maximo por llamada: 8 MiB.
- Formato del payload: `v1.aes-256-gcm.<iv>.<ciphertext>.<tag>`.
- `fromPassword` requiere salt persistente. Sin salt persistente no se puede derivar de nuevo la misma clave tras login.

## Propuesta de modelo

### Identidad

Al crear una identidad:

1. Generar `masterKey = SymmetricKey.generate()`.
2. Derivar `passwordKey = await SymmetricKey.fromPasswordUsingOwasp(password, { salt })`.
3. Cifrar la master key con `passwordKey.encrypt(masterKey.valueOf())`.
4. Persistir `encryptedMasterKey` y `masterKeySalt`.
5. Mantener `encryptedKeyPair` para firmar y compartir claves con otros usuarios.

La sesion hidratada deberia llevar la master key descifrada:

```ts
type Session = {
  encryptedKeyPair: EncryptedKeyPair;
  identity: IdentityResource;
  keychain: LocalKeychain;
  keychainExternalIdentifier?: null | string;
  masterKey: SymmetricKey;
  password: string;
};
```

### Keychain

Nueva estructura interna versionada:

```ts
type LocalKeychainV2 = {
  conversations: Record<string, ConversationSymmetricKeyEntry>;
  communities: Record<string, CommunitySymmetricKeyEntry>;
  version: number;
};

type ConversationSymmetricKeyEntry = {
  algorithm: 'aes-256-gcm';
  conversationId: string;
  createdAt: number;
  key: string; // SymmetricKey base64
  kind: 'conversation';
  version: 2;
};

type CommunitySymmetricKeyEntry = {
  algorithm: 'aes-256-gcm';
  communityId: string;
  createdAt: number;
  key: string; // SymmetricKey base64
  kind: 'community';
  version: 2;
};
```

Recomendacion: separar `communities` de `conversations`. Mantener comunidades dentro de `conversations` funciona, pero perpetua una ambiguedad que ya esta causando dudas: una comunidad no es una conversacion.

La keychain completa seguiria cifrada con `masterKey`, no con la clave privada asimetrica.

### Mensajes de conversaciones y grupos

Para enviar:

1. Resolver `ConversationSymmetricKeyEntry`.
2. Serializar el payload de mensaje igual que hoy.
3. Cifrar con `SymmetricKey.fromBase64(entry.key).encrypt(plaintext, { aad })`.
4. Firmar el `encryptedPayload` igual que hoy con la clave de identidad.

`aad` recomendado:

```ts
`${conversationId}:${messageId}:${createdAt}`
```

Esto liga el ciphertext al contexto sin cambiar el body publico.

Para leer:

1. Resolver la key simetrica de la conversacion.
2. Descifrar con `SymmetricKey.decrypt`.
3. Proyectar `ChatMessage` igual que hoy.

### Comunidades privadas

Al crear comunidad privada:

1. Generar `communityKey = SymmetricKey.generate()`.
2. Guardar entrada en `keychain.communities[community.id]`.
3. Cifrar mensajes de canal con esa key.

La clave asimetrica de comunidad deja de ser necesaria para cifrar mensajes.

Sigue haciendo falta asimetria para compartir:

- invitaciones directas: cifrar la key simetrica de comunidad con la public key del destinatario;
- invite links: cifrar la key simetrica con el secreto corto del link;
- firma de dominio: seguir firmando con la key pair de identidad.

### Comunidades publicas

No cambian: siguen usando `plaintextPayload`.

### Drafts y preferencias locales

Los drafts ya deberian moverse a `masterKey`, no a `encryptedKeyPair`, para alinearse con "salvo compartir, todo simetrico".

Preferencias locales ya usan `SymmetricKey` en `useWorkspacePreferences`, por lo que sirven como referencia tecnica.

## Contrato backend necesario

Hay dos caminos:

### Opcion A: backend extiende identidad

Agregar a `IdentityResource` y `POST /identities/`:

```ts
{
  encryptedMasterKey: string;
  masterKeyDerivation: {
    algorithm: 'scrypt';
    salt: string;
    N: number;
    r: number;
    p: number;
    version: 1;
  };
}
```

Ventajas:

- Login puede obtener todo desde la identidad.
- La master key queda asociada al usuario desde el inicio.

Coste:

- Cambia firma canonica de identidad.
- Backend debe persistir campos nuevos.
- Requiere migracion de identidades existentes.

### Opcion B: master key dentro de keychain

Mantener `IdentityResource` sin cambios y publicar una keychain inicial que contenga el material necesario cifrado con password.

No lo recomiendo como primera opcion: el login actual carga identidad antes de keychain, y la keychain futura deberia cifrarse con master key. Se crea una dependencia circular si la master key vive solo dentro de la keychain.

Recomendacion: Opcion A.

## Migracion

No conviene hacer big bang sin compatibilidad interna.

Plan recomendado:

1. Actualizar libreria a `@haskou/value-objects@2.10.0`.
2. Introducir tipos versionados:
   - `LocalKeychainV1`
   - `LocalKeychainV2`
   - `ConversationKeyEntryV1`
   - `ConversationSymmetricKeyEntry`
   - `CommunitySymmetricKeyEntry`
3. Hidratar keychains V1 y V2.
4. Al login, si la identidad tiene master key:
   - descifrar keychain con master key;
   - usar mensajes simetricos.
5. Si no tiene master key:
   - mantener lectura V1;
   - ofrecer migracion al guardar/publicar keychain.
6. Al enviar nuevos mensajes en conversaciones/comunidades migradas, usar simetrico.
7. Mantener decrypt dual durante la migracion:
   - si payload parece `v1.aes-256-gcm...`, usar `SymmetricKey`;
   - si no, fallback a `PrivateKey`.

Si no hay usuarios reales que conservar, se puede simplificar eliminando compatibilidad V1. Pero hay que coordinarlo con backend y despliegue, porque mensajes antiguos no se podran leer sin migracion.

## Impacto en codigo frontend

Areas principales:

- `IdentityResource`: nuevos campos de master key.
- `PigeonApiGateway.createIdentity`: generar master key, derivar password key, firmar/persistir nuevos campos.
- `PigeonApiGateway.login`: descifrar master key y meterla en `Session`.
- `KeychainCipher`: pasar de `session.encryptedKeyPair.encrypt/decrypt` a `session.masterKey.encrypt/decrypt`.
- `LocalKeychain`: versionar y separar comunidades.
- `ConversationKeychain`: resolver entries V1/V2 y comunidades por contexto correcto.
- `PigeonApiGateway.encryptMessagePayload`: usar `SymmetricKey`.
- `messageDecryptWorker`: aceptar key simetrica o key entry versionada.
- `communityChannelPayloadCipher`: usar `SymmetricKey` para comunidades privadas.
- `communityMessageDecryptWorker`: usar `SymmetricKey`.
- `DraftPayloadCipher`: usar master key.
- Invitaciones directas: compartir entry simetrica cifrada con public key del destinatario.
- Invite links: cifrar entry simetrica con secreto del link.

## Impacto en backend

Backend no necesita saber la estructura interna de la keychain, pero si necesita cambios si se elige la opcion recomendada:

- aceptar y devolver `encryptedMasterKey` y `masterKeyDerivation` en identidades;
- incluir esos campos en la firma canonica de identidad;
- documentar OpenAPI;
- mantener keychains como blob opaco.

Backend no necesita cambiar mensajes si el campo sigue siendo `encryptedPayload` y las firmas canonicas siguen firmando ese string.

## Riesgos

- `SymmetricKey.MAX_PAYLOAD_LENGTH` es 8 MiB. No se debe usar para cifrar adjuntos grandes completos en memoria. Para adjuntos grandes hay que mantener estrategia de fichero/thumbnail/chunks.
- Cambiar la keychain sin migracion rompe lectura de mensajes antiguos.
- Cambiar identidad requiere actualizar firma canonica. Si frontend firma campos que backend no reconstruye, fallara validacion.
- Invite links actuales ya usan envelope AES-GCM, pero cifran `ConversationKeyEntry`; habria que cambiar el payload a `CommunitySymmetricKeyEntry`.
- Las comunidades actuales estan guardadas bajo `conversations[communityId]`; conviene migrarlas a `communities[communityId]` para no seguir mezclando conceptos.

## Resultado del spike

El cambio es viable.

La asimetria sigue siendo necesaria para:

- identidad y firmas;
- compartir claves con destinatarios concretos;
- compatibilidad de invitaciones mientras haya payloads V1.

La asimetria no es necesaria para:

- cifrar mensajes normales;
- cifrar mensajes de comunidades privadas;
- cifrar drafts;
- cifrar la keychain remota una vez exista master key.

La implementacion deberia hacerse como migracion versionada, no como refactor directo, salvo que se acepte perder compatibilidad con identidades/keychains/mensajes antiguos.
