// Streamed instantly on navigation to /admin/questions while the server fetches
// the question bank — branded loader with question-specific status messages.

import { AppLoader } from "@/components/shared/animations";

export default function Loading() {
  return (
    <AppLoader
      label="Loading the question library"
      messages={[
        "Connecting to the question bank…",
        "Fetching questions…",
        "Organizing by module…",
        "Almost ready…",
      ]}
    />
  );
}
