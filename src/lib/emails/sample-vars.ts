// Shared sample variables for email templates.
//
// Single source of truth used by BOTH the admin "Send test to me" action
// (server) and the in-app template preview (client), so a preview always
// matches what a test send produces.

export function buildSampleVars(opts?: {
  name?: string;
  appUrl?: string;
}): Record<string, string> {
  const name = opts?.name?.trim() || "Alex Carter";
  const appUrl = opts?.appUrl ?? "";
  return {
    name,
    module_title: "Operations & Leadership",
    score: "92",
    next_module_date: "next month",
    due_date: "Friday",
    invite_link: `${appUrl}/auth/accept-invite`,
    reset_link: `${appUrl}/auth/reset-password`,
    app_url: appUrl,
    progress_link: `${appUrl}/manager/progress`,
    retake_link: `${appUrl}/manager/dashboard`,
    quiz_link: `${appUrl}/manager/dashboard`,
    first_module_date: "next month",
    employee_name: "Jordan Lee",
    admin_name: name,
    cohort: "Atlanta",
    reason: "two failed retakes",
    profile_link: `${appUrl}/admin/managers`,
  };
}
