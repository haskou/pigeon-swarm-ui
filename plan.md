# Plan: endurecer desbloqueo criptografico de identidad y llavero

## Objetivo

Corregir el modelo criptografico para que, en modo seguro, no exista ningun camino donde una password sola pueda validar o desbloquear secretos atacables offline.

El resultado esperado es:

- La password deriva una `PasswordKEK` con scrypt fuerte.
- La recovery key portable aporta un segundo factor criptografico independiente del dominio.
- La passkey/WebAuthn PRF no forma parte del diseno: su codigo se elimino en #241 y reintroducirla es una decision de producto (ver Pendientes de decision).
- La `UserRootKey`/`MasterKey` es la unica raiz que desbloquea la private identity key, keychain y claves internas del usuario.
- Cambiar password solo reenvuelve la `UserRootKey`/`MasterKey`.
- Cambiar password no cambia la identity key pair ni claves de chats/comunidades.

## Estado actual relevante

Archivos principales detectados:

- `src/contexts/identities/infrastructure/crypto/UserRootKeyProtector.ts`
- `src/contexts/identities/infrastructure/crypto/KeychainCipher.ts`
- `src/app/composition/PigeonApiGateway.ts`
- `src/shared/presentation/i18n/es.ts`
- `src/shared/presentation/i18n/en.ts`

Responsabilidades actuales:

- `UserRootKeyProtector` protege/desbloquea la master key y cifra/descifra la identity key pair usando la master key.
- `KeychainCipher` cifra y descifra keychains usando `session.masterKey`.

## Decisiones de diseno

1. Sin passkey PRF en el diseno.

   WebAuthn esta ligado al RP ID/origen. Una passkey creada para `localhost` no sirve como secreto portable para otro dominio o IP local, asi que PRF nunca podria ser el recovery entre nodos P2P. Su codigo se elimino en #241 porque ninguna identidad la creo.

2. Introducir recovery key portable.

   Al crear identidad se genera una clave aleatoria de 32 bytes y se muestra al usuario como secreto portable, por ejemplo:

   ```text
   psrk1.<base64url-payload>
   ```

   Esa recovery key no se sube al backend, no se guarda en claro y no depende del dominio.

3. Modo seguro por defecto: password + recovery key.

   En modo seguro, el blob remoto no debe poder validarse con password sola.

   Flujo conceptual:

   ```ts
   PasswordKEK = SymmetricKey.fromPassword(password, {
     salt,
     N: 2 ** 18,
     r: 8,
     p: 1,
   });

   RecoveryKEK = HKDF(recoveryKey, {
     info: '@pigeon/recovery-key/v1',
   });

   FinalKEK = HKDF(PasswordKEK || RecoveryKEK, {
     info: '@pigeon/user-root-key/password+recovery/v1',
   });
   ```

   `FinalKEK` cifra la `UserRootKey`/`MasterKey`.

4. Password-only solo como modo portable/debilitado explicito.

   Puede existir solo si se decide mantener un modo menos seguro. Debe estar marcado en datos y UI como portable/debilitado. No debe activarse por fallback silencioso.

## Modelo de datos propuesto

### Backend

Backend debe seguir tratando los campos criptograficos como blobs opacos firmados.

Nuevo modelo recomendado en `IdentityResource`:

```ts
type IdentityResource = {
  id: string;
  encryptedKeyPair: EncryptedIdentityKeyPairResource;
  masterKeyEnvelopes: MasterKeyEnvelopeResource[];
  networks: string[];
  previousIdentityExternalIdentifier?: string;
  profile: IdentityProfileResource;
  timestamp: number;
  version: number;
  signature: string;
};

type MasterKeyEnvelopeResource = {
  id: string;
  type: 'password_recovery' | 'password_only_portable';
  encryptedMasterKey: string;
  derivation: Record<string, unknown>;
  createdAt: number;
  updatedAt?: number;
  deviceLabel?: string;
};
```

El payload canonico firmado de identidad debe cubrir `masterKeyEnvelopes`.

Si se quiere minimizar el cambio inicial de backend, se puede mantener temporalmente:

- `encryptedMasterKey`
- `masterKeyDerivation`

Pero entonces solo habria un envelope remoto. Para soportar mas de un metodo de unlock, `masterKeyEnvelopes[]` es la estructura correcta.

### Frontend

Crear Value Objects o clases cohesivas para evitar strings magicos:

- `RecoveryKey`
- `RecoveryKeyEnvelope`
- `MasterKeyEnvelope`
- `MasterKeyEnvelopeType`
- `PasswordKeyDerivationProfile`
- `UserRootKey`

No extraer primitivas para comparar o decidir reglas. Las conversiones a primitivos quedan en mappers/DTOs.

## Flujos

### Crear identidad

1. Usuario introduce password.
2. Frontend genera identity key pair.
3. Frontend genera `UserRootKey`/`MasterKey` aleatoria.
4. Frontend genera recovery key aleatoria de 32 bytes.
5. Frontend deriva `PasswordKEK` con scrypt fuerte:

   ```ts
   N = 2 ** 18;
   r = 8;
   p = 1;
   ```

6. Frontend deriva `RecoveryKEK` con HKDF.
7. Frontend combina `PasswordKEK || RecoveryKEK` con HKDF para obtener `FinalKEK`.
8. `FinalKEK` cifra `UserRootKey`/`MasterKey`.
9. `UserRootKey`/`MasterKey` cifra la private identity key existente.
10. Frontend muestra recovery key al usuario y exige confirmacion antes de finalizar.
11. Frontend publica la identidad firmada.

### Login en un dispositivo nuevo

1. Usuario introduce identidad/handler.
2. Frontend descarga identidad.
3. Si la identidad tiene envelope `password_recovery`, UI pide:

   - password
   - recovery key

4. Frontend deriva `PasswordKEK`.
5. Frontend deriva `RecoveryKEK`.
6. Frontend combina ambas con HKDF y obtiene `FinalKEK`.
7. `FinalKEK` descifra `UserRootKey`/`MasterKey`.
8. `UserRootKey`/`MasterKey` descifra private identity key y keychain.
9. Frontend abre workspace.

### Cambiar password

No conservar la password vieja en memoria.

Precondicion: la `UserRootKey`/`MasterKey` ya esta desbloqueada en la sesion.

1. Usuario introduce nueva password.
2. Frontend genera nuevo salt/KDF params.
3. Frontend deriva `newPasswordKEK`.
4. Si el envelope requiere recovery, pedir o reutilizar recovery key solo si el usuario la introduce en ese flujo.
5. Derivar `newFinalKEK`.
6. Reenvolver la misma `UserRootKey`/`MasterKey`.
7. Refirmar/publicar identidad.
8. No regenerar identity key pair.
9. No tocar claves de chats ni comunidades.
10. Cerrar sesion o forzar unlock limpio despues de cambiar password.

## Backend: cambios necesarios

1. Persistir nuevos campos opacos en identidad:

   - `masterKeyEnvelopes`
   - o, si se decide fase intermedia, mantener `encryptedMasterKey` y `masterKeyDerivation` con metadata de recovery.

2. Incluir esos campos en firma canonica de identidad.

3. Exigir que `PUT /identities/{id}` preserve los envelopes para no perder acceso a la identidad.

4. No interpretar ni descifrar:

   - recovery metadata
   - encrypted master keys
   - encrypted key pairs

5. Documentar en API que el backend solo persiste blobs opacos firmados.

6. Validar integridad contractual del keychain sin interpretar criptografia.

   Backend debe seguir tratando el keychain como un blob opaco cifrado por frontend. No debe descifrarlo ni validar si puede abrirse con password, recovery key o master key.

   Si se publica o actualiza un keychain, backend debe validar:

   - La request esta firmada por la identidad propietaria.
   - El keychain pertenece a la identidad autenticada.
   - El payload tiene la forma esperada.
   - El encrypted payload existe y no esta vacio.
   - Las reglas de version/timestamp/previous version se mantienen si el backend ya las exige.
   - Una actualizacion no borra accidentalmente metadata necesaria del keychain, si esa metadata existe en el contrato.

   Backend no debe validar:

   - `UserRootKey`/`MasterKey`.
   - recovery key.
   - `PasswordKEK` o `FinalKEK`.
   - claves simetricas de chats/comunidades.
   - contenido descifrado del keychain.

7. Validar preservacion de envelopes criticos en identidad.

   Si se introduce `masterKeyEnvelopes[]`, backend debe impedir que `PUT /identities/{id}` elimine accidentalmente todos los envelopes o deje la identidad sin ningun metodo de unlock valido, salvo que exista un flujo explicito de rotacion/revocacion firmado.

   La firma canonica de identidad debe cubrir esos envelopes. Si alguien modifica, borra o reordena datos criticos de unlock, la firma debe dejar de validar.

## Frontend: cambios necesarios

1. Crear dominio criptografico explicito para recovery/envelopes.
2. Actualizar creacion de identidad para generar y mostrar recovery key.
3. Actualizar login para elegir metodo de unlock segun envelopes disponibles.
4. Actualizar cambio de password para reenvolver master key sin password vieja.
5. Eliminar cualquier camino donde password sola descifre private identity key.
6. Eliminar cualquier almacenamiento de:

   - password
   - `PasswordKEK`
   - `FinalKEK`
   - master key en claro

7. Mantener `session.masterKey` solo en memoria durante la sesion activa.
8. Limpiar secretos en logout, error de unlock y retorno al login.
9. Actualizar textos ES/EN.

## UX requerida

### Registro

- Mostrar recovery key con aviso claro:

  ```text
  Guarda esta clave de recuperacion. La necesitaras para abrir tu identidad desde otro nodo o navegador.
  ```

- Obligar a confirmar que se ha guardado.
- Ofrecer descarga/QR/copia.

### Login

- Pedir password + recovery key.

### Ajustes de seguridad

- Mostrar estado:

  - Recovery key configurada.
  - Modo portable/debilitado si existe password-only.

- Permitir regenerar recovery key solo con sesion desbloqueada.

## Seguridad: prohibiciones

No guardar:

- password
- `PasswordKEK`
- `FinalKEK`
- `encryptedPasswordKey`
- `passwordKey`
- `UserRootKey`/`MasterKey` en claro
- private identity key cifrada solo con password
- ningun envelope activo que permita validar secretos con password sola en modo seguro

No hacer:

- fallback silencioso a password-only si una identidad requiere recovery key.
- regenerar identity key pair durante migracion.
- cambiar public key/identityId.
- cambiar claves simetricas de comunidades al cambiar password.
- cambiar claves de conversaciones al cambiar password.

## Migracion

Corte limpio: no existen identidades anteriores que migrar. Toda identidad nueva usa recovery key obligatoria.

## Tests

### Unitarios

- `RecoveryKey` genera, serializa y parsea `psrk1`.
- `RecoveryKey` rechaza formato invalido.
- `PasswordKeyDerivationProfile` usa `N = 2 ** 18`, `r = 8`, `p = 1`.
- `FinalKEK` cambia si cambia password.
- `FinalKEK` cambia si cambia recovery key.
- Password correcta + recovery incorrecta no descifra.
- Password incorrecta + recovery correcta no descifra.
- Password correcta + recovery correcta descifra.
- Private identity key no se puede descifrar con password sola.
- Cambiar password no cambia public key/identityId.
- Cambiar password no cambia claves de comunidades/conversaciones.

### Integracion

- Crear identidad con recovery key.
- Login en dispositivo nuevo con password + recovery key.
- Logout limpia secretos.
- Cambio de password reenvuelve master key y vuelve al login.

### E2E

- Registro muestra recovery key y exige confirmacion.
- Login pide password + recovery key.
- Recovery key permite entrar desde otro origen/nodo.

## Orden de implementacion recomendado

1. Definir modelo `MasterKeyEnvelope` y `RecoveryKey`.
2. Actualizar contrato backend o confirmar que `masterKeyDerivation` sigue siendo opaco suficiente para fase inicial.
3. Implementar derivacion password + recovery.
4. Reenvolver private identity key bajo `UserRootKey`/`MasterKey`.
5. Actualizar registro y login.
6. Actualizar cambio de password.
7. Actualizar UI/UX de recovery y seguridad.
8. Anadir tests unitarios.
9. Anadir tests de integracion/e2e.
10. Ejecutar `yarn lint`, `yarn typecheck` y tests relevantes.

## Riesgos

- Si se conserva cualquier envelope password-only activo, el objetivo de resistencia a ataque offline queda roto.
- Si se cambia identity key pair, se rompe lectura de mensajes cifrados para la public key anterior.
- Si se guarda una KEK derivada, se convierte en un secreto reutilizable robable.
- Si backend no firma los nuevos campos, un atacante podria manipular metadata/envelopes.

## Pendientes de decision

1. Confirmar si backend acepta `masterKeyEnvelopes[]` o si se hace fase intermedia con `encryptedMasterKey/masterKeyDerivation`.
2. Elegir formato final de recovery key:

   - `psrk1.<base64url>`
   - palabras tipo mnemonic
   - QR
   - archivo `.pigeon-recovery`

3. Decidir si se permite modo password-only portable/debilitado.
4. Decidir si identidades existentes se migran o se fuerza corte limpio.
5. Decidir si se reintroduce passkey PRF como desbloqueo local. Su codigo se elimino en #241 y no forma parte de este plan.
