import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-linear-to-b from-background to-slate-900/50">
      <div className="relative group">
        <div className="absolute -inset-1 bg-linear-to-r from-primary to-blue-600 rounded-lg blur-sm opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative px-8 py-6 bg-background rounded-lg leading-none flex items-center gap-6">
          <h1 className="text-slate-100 text-3xl font-bold tracking-tight">NextMed</h1>
          <Button variant="outline" className="text-primary hover:text-blue-400 border-slate-800">
            Premium Skeleton &rarr;
          </Button>
        </div>
      </div>

      <p className="mt-8 text-secondary text-lg font-medium animate-pulse">
        Initializing surgical precision...
      </p>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
        <div className="p-6 rounded-xl border border-slate-800/50 bg-slate-900/20 backdrop-blur-sm hover:border-primary/50 transition-colors">
          <h3 className="text-lg font-semibold mb-2">Patient Care</h3>
          <p className="text-sm text-secondary">Advanced tracking and management systems.</p>
        </div>
        <div className="p-6 rounded-xl border border-slate-800/50 bg-slate-900/20 backdrop-blur-sm hover:border-primary/50 transition-colors">
          <h3 className="text-lg font-semibold mb-2">Diagnostics</h3>
          <p className="text-sm text-secondary">AI-powered medical imaging analysis.</p>
        </div>
        <div className="p-6 rounded-xl border border-slate-800/50 bg-slate-900/20 backdrop-blur-sm hover:border-primary/50 transition-colors">
          <h3 className="text-lg font-semibold mb-2">Compliance</h3>
          <p className="text-sm text-secondary">Security-first architecture for medical data.</p>
        </div>
      </div>
    </main>
  );
}
