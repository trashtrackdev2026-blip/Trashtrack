import { notFound } from "next/navigation";
import SeedTools from "./SeedTools";

export default function SeedPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SeedTools />;
}
