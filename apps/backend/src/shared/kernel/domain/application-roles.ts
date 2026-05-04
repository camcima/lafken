export const ApplicationRole = {
  PLATFORM_OPERATOR: "lafken_platform_operator",
  CONTENT_REVIEWER: "lafken_content_reviewer",
  APPLICATION_DEVELOPER: "lafken_application_developer",
} as const;

export type ApplicationRole = (typeof ApplicationRole)[keyof typeof ApplicationRole];
