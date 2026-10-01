export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public details?: unknown) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (entity: string) => new AppError(`${entity.toUpperCase().replace(/\s+/g, "_")}_NOT_FOUND`, `${entity[0].toUpperCase()}${entity.slice(1)} not found`, 404);
