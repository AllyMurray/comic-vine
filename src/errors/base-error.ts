import { HttpClientError } from '@http-client-toolkit/core';

interface ErrorDetails {
  message: string;
  help: string;
}

type CaptureStackTrace = (
  targetObject: object,
  constructorOpt?: abstract new (...args: Array<never>) => object,
) => void;

interface V8ErrorConstructor extends ErrorConstructor {
  captureStackTrace: CaptureStackTrace;
}

function hasCaptureStackTrace(
  errorConstructor: ErrorConstructor,
): errorConstructor is V8ErrorConstructor {
  return (
    'captureStackTrace' in errorConstructor &&
    typeof Reflect.get(errorConstructor, 'captureStackTrace') === 'function'
  );
}

export abstract class BaseError extends HttpClientError {
  public help: string;

  constructor(details: ErrorDetails) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(details.message);
    this.name = this.constructor.name;

    // Remove constructor invocation from the stack trace. Only available in V8.
    if (hasCaptureStackTrace(Error)) {
      Error.captureStackTrace(this, new.target);
    }

    // Custom debugging information
    this.help = details.help;
  }
}
