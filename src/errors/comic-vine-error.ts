interface ErrorDetails {
  message: string;
  help: string;
}

export abstract class ComicVineError extends Error {
  public help: string;

  constructor(details: ErrorDetails) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(details.message);
    this.name = this.constructor.name;

    // Remove constructor invocation from the stack trace. Only available in V8.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Custom debugging information
    this.help = details.help;
  }
}
