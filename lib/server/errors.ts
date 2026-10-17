import { UserFacingError } from "@/lib/backend/types";

export class ForbiddenError extends UserFacingError {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends UserFacingError {
  constructor(message = "We couldn't find that record. It may have been deleted.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class PlanLimitError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export { UserFacingError };
