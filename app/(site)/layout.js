import Sidebar from "@/components/Sidebar";

export default function SiteLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-[16.666%] w-[83.333%] min-h-screen">
        {children}
      </main>
    </div>
  );
}
