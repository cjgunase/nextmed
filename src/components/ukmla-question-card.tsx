import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type UkmlaQuestionCardProps = {
    id: number;
    stem: string;
    category: string;
    difficultyLevel: string;
    isDue: boolean;
    nextReviewDate: Date | null;
};

export function UkmlaQuestionCard({
    id,
    stem,
    category,
    difficultyLevel,
    isDue,
    nextReviewDate,
}: UkmlaQuestionCardProps) {
    return (
        <Card className="h-full">
            <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{category}</Badge>
                    <Badge variant="outline">{difficultyLevel}</Badge>
                    {isDue && <Badge>Due</Badge>}
                </div>
                <CardTitle className="line-clamp-3 text-base">{stem}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                    {nextReviewDate
                        ? `Next review: ${new Date(nextReviewDate).toLocaleDateString()}`
                        : 'Not reviewed yet'}
                </p>
                <Link href={`/ukmla/${id}`}>
                    <Button className="w-full">Start Question</Button>
                </Link>
            </CardContent>
        </Card>
    );
}
