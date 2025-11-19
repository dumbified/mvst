import DemandWaterfallTable from "./components/DemandWaterfallTable";
import UploadControls from "./components/UploadControls";

export default function Home() {
  return (
    <main className="min-h-screen p-6 md:p-10 flex flex-col gap-6 bg-white">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold">MVST Demand Waterfall</h1>
      </header>
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="text-xs text-neutral-500">SO = Sales Orders · SS = Safety Stock</div>
          <UploadControls />
        </div>
        <div className="overflow-auto rounded-lg border border-neutral-200/60 bg-white">
          <DemandWaterfallTable />
        </div>
      </section>
    </main>
  );
}
