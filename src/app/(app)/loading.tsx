import { AppLoader } from "@/components/shared/animations";

export default function Loading() {
  return (
    <AppLoader
      messages={[
        "Fetching your data…",
        "Getting everything ready…",
        "Almost there…",
      ]}
    />
  );
}
