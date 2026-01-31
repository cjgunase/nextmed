import { loadCaseForSimulator } from "@/actions/simulator";
import { SimulatorPlayer } from "@/components/simulator/SimulatorPlayer";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default async function SimulatorPage({
    params
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const caseId = parseInt(id);

    if (isNaN(caseId)) {
        notFound();
    }

    const medicalCase = await loadCaseForSimulator(caseId);

    if (!medicalCase) {
        notFound();
    }

    if (medicalCase.stages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <AlertCircle className="h-16 w-16 text-yellow-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Incomplete Case</h1>
                <p className="text-muted-foreground mb-8 max-w-md">
                    This case has no stages yet and cannot be simulated.
                </p>
                <div className="flex gap-4">
                    <Link href="/cases">
                        <Button variant="outline">Back to Cases</Button>
                    </Link>
                    <Link href={`/cases/${caseId}/edit`}>
                        <Button>Edit Case</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <SimulatorPlayer medicalCase={medicalCase} />
        </div>
    );
}
