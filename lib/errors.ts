export class AppError extends Error {
  constructor(public code: string, message: string, public status = 500) {
    super(message);
    this.name = "AppError";
  }
}
