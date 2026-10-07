import { getDatabase } from "@repo/database";
import type { Metadata } from "next";
import { Header } from "./components/header";

const title = "Acme Inc";
const description = "My application.";

export const metadata: Metadata = {
  description,
  title,
};

export default async function App() {
  const pages = await getDatabase().query.pages.findMany();

  return (
    <>
      <Header
        currentPage="Data Fetching"
        pages={["Building Your Application"]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          {pages.map((page) => (
            <div className="aspect-video rounded-xl bg-muted/50" key={page.id}>
              {page.name}
            </div>
          ))}
        </div>
        <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min" />
      </div>
    </>
  );
}
