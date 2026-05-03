// TODO(template): These roles are just examples, replace them with the actual roles of your application where the key can be anything while the values are the actual Entra ID application role values.
export const ApplicationRole = {
  ADMIN: "emx_tmpl_exmonorepo_admin",
  VIEWER: "emx_tmpl_exmonorepo_viewer",
} as const;

export type ApplicationRole = (typeof ApplicationRole)[keyof typeof ApplicationRole];
