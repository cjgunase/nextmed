import { Button } from "@/components/ui/button";
import { StageOption } from "@/db/schema"; // We can use the inferred type from schema
import { motion } from "framer-motion";

interface DecisionPanelProps {
    options: {
        id: number;
        text: string;
        // we don't need other props for selection phase
    }[];
    onSelectOption: (optionId: number) => void;
    disabled: boolean;
}

export function DecisionPanel({ options, onSelectOption, disabled }: DecisionPanelProps) {
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold mb-4">What is your next step?</h3>
            <div className="grid grid-cols-1 gap-3">
                {options.map((option, index) => (
                    <motion.div
                        key={option.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <Button
                            variant="outline"
                            className="w-full justify-start text-left h-auto p-4 whitespace-normal text-base hover:bg-primary/5 hover:border-primary transition-all"
                            onClick={() => onSelectOption(option.id)}
                            disabled={disabled}
                        >
                            <span className="mr-3 font-mono text-muted-foreground opacity-50">
                                {String.fromCharCode(65 + index)}.
                            </span>
                            {option.text}
                        </Button>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
