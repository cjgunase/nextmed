import { Activity, Thermometer, Wind, Droplets } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

interface ClinicalData {
    BP?: string;
    HR?: number;
    RR?: number;
    Temp?: number;
    SpO2?: number;
    notes?: string[];
    labs?: Record<string, string | number>;
    [key: string]: unknown;
}

interface ClinicalDataDisplayProps {
    data: ClinicalData | null;
}

export function ClinicalDataDisplay({ data }: ClinicalDataDisplayProps) {
    if (!data) return null;

    // Helper to determine if a value is abnormal (rudimentary logic for demo)
    const isAbnormal = (key: string, value: unknown) => {
        if (!value) return false;
        // Add more sophisticated logic later
        if (key === 'SpO2' && typeof value === 'number' && value < 94) return true;
        if (key === 'HR' && typeof value === 'number' && (value > 100 || value < 60)) return true;
        if (key === 'RR' && typeof value === 'number' && (value > 20 || value < 12)) return true;
        if (key === 'Temp' && typeof value === 'number' && (value > 37.5 || value < 36)) return true;
        if (key === 'BP' && typeof value === 'string') {
            const systolic = parseInt(value.split('/')[0]);
            return systolic < 90 || systolic > 140;
        }
        return false;
    };

    return (
        <Card className="border-l-4 border-l-blue-500 shadow-md">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-500" />
                    Clinical Data
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <VitalSign
                        icon={<Activity className="h-4 w-4" />}
                        label="HR"
                        value={data.HR}
                        unit="bpm"
                        abnormal={isAbnormal('HR', data.HR)}
                    />
                    <VitalSign
                        icon={<div className="font-bold text-xs">BP</div>}
                        label="BP"
                        value={data.BP}
                        unit="mmHg"
                        abnormal={isAbnormal('BP', data.BP)}
                    />
                    <VitalSign
                        icon={<Wind className="h-4 w-4" />}
                        label="RR"
                        value={data.RR}
                        unit="/min"
                        abnormal={isAbnormal('RR', data.RR)}
                    />
                    <VitalSign
                        icon={<Droplets className="h-4 w-4" />}
                        label="SpO2"
                        value={data.SpO2}
                        unit="%"
                        abnormal={isAbnormal('SpO2', data.SpO2)}
                    />
                    <VitalSign
                        icon={<Thermometer className="h-4 w-4" />}
                        label="Temp"
                        value={data.Temp}
                        unit="°C"
                        abnormal={isAbnormal('Temp', data.Temp)}
                    />
                </div>

                {data.labs && Object.keys(data.labs).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Lab Results</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            {Object.entries(data.labs).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                    <span className="capitalize">{key}:</span>
                                    <span className="font-mono font-medium">{String(value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {data.notes && data.notes.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Clinical Notes</h4>
                        <ul className="list-disc list-inside text-sm space-y-1">
                            {data.notes.map((note, idx) => (
                                <li key={idx}>{note}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

type VitalSignProps = {
    icon: ReactNode;
    label: string;
    value: string | number | null | undefined;
    unit: string;
    abnormal: boolean;
};

function VitalSign({ icon, label, value, unit, abnormal }: VitalSignProps) {
    if (value === undefined || value === null) return null;

    return (
        <div className={`flex flex-col items-center p-2 rounded bg-slate-50 dark:bg-slate-900 border ${abnormal ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900' : 'border-slate-100 dark:border-slate-800'}`}>
            <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                {icon} {label}
            </span>
            <span className={`text-lg font-bold ${abnormal ? 'text-red-600 dark:text-red-400' : ''}`}>
                {value}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">{unit}</span>
            </span>
        </div>
    );
}
