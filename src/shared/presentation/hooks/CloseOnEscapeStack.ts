export class CloseOnEscapeStack {
  private readonly tokens: symbol[] = [];

  public add(): symbol {
    const token = Symbol('close-on-escape');
    this.tokens.push(token);

    return token;
  }

  public remove(token: symbol): void {
    const index = this.tokens.indexOf(token);
    if (index >= 0) this.tokens.splice(index, 1);
  }

  public isTopmost(token: symbol): boolean {
    return this.tokens[this.tokens.length - 1] === token;
  }

  public count(): number {
    return this.tokens.length;
  }
}

export const closeOnEscapeStack = new CloseOnEscapeStack();
