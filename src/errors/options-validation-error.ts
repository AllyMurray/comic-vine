import { BaseError } from './base-error';

export class OptionsValidationError extends BaseError {
  constructor(path: Array<string | number>, message: string) {
    super({
      message: `Property: ${path.join('.')}, Problem: ${message}`,
      help: 'If the error message does not provide enough information or you believe there is a bug, please open a Github issue with steps to reproduce: https://github.com/AllyMurray/comic-vine/issues',
    });
  }
}
