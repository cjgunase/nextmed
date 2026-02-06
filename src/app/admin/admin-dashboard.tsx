'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    getAdminCases,
    createCase,
    createStage,
    createOption,
    deleteCase,
    togglePublish,
    updateCase,
    updateStage,
    updateOption,
    deleteStage,
    deleteOption
} from '@/actions/admin';
import { generateCaseAction, generateClinicalDataAction } from '@/actions/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
    Loader2,
    Plus,
    Trash2,
    ChevronDown,
    ChevronRight,
    Layout,
    FileText,
    MessageSquare,
    Sparkles,
    Bot,
    Eye,
    EyeOff,
    Save,
    Edit,
    X
} from 'lucide-react';

type Case = {
    id: number;
    title: string;
    description: string;
    clinicalDomain: string;
    difficultyLevel: 'Foundation' | 'Core' | 'Advanced';
    verificationStatus?: string;
    qualityScore?: number;
    rigourScore?: number;
    isPublished: boolean;
    createdAt: string | Date;
    updatedAt: string | Date;
    user?: {
        email: string;
        firstName?: string | null;
        lastName?: string | null;
    } | null;
    stages: Stage[];
};

type Stage = {
    id: number;
    caseId: number;
    stageOrder: number;
    narrative: string;
    clinicalData: unknown;
    mediaUrl?: string | null;
    options: Option[];
};

type Option = {
    id: number;
    stageId: number;
    text: string;
    isCorrect: boolean;
    scoreWeight: number;
    feedback: string;
};

type CreatorOption = {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
};

type AdminCasesQuery = {
    page: number;
    pageSize: number;
    creatorId: string;
    clinicalDomain: string;
    dateField: 'created' | 'modified';
    dateFrom: string;
    dateTo: string;
};

type DifficultyLevel = 'Foundation' | 'Core' | 'Advanced';
type VerificationStatus = 'draft' | 'verified' | 'rejected';

type CaseFormInput = {
    title: string;
    description: string;
    clinicalDomain: string;
    difficultyLevel: DifficultyLevel | '' | 'auto';
    userId: string;
};

type EditCaseFormInput = {
    id?: number;
    title?: string;
    description?: string;
    clinicalDomain?: string;
    difficultyLevel?: DifficultyLevel;
    verificationStatus?: VerificationStatus;
    qualityScore?: number;
    rigourScore?: number;
};

type EditStageFormInput = {
    id?: number;
    narrative?: string;
    clinicalData?: string;
    mediaUrl?: string | null;
};

type EditOptionFormInput = {
    id?: number;
    text?: string;
    isCorrect?: boolean;
    scoreWeight?: number;
    feedback?: string;
};

function isDifficultyLevel(value: string): value is DifficultyLevel {
    return value === 'Foundation' || value === 'Core' || value === 'Advanced';
}

// Helper function to check if a case is complete and ready to publish
function isCaseComplete(caseItem: Case): { complete: boolean; reason?: string } {
    if (caseItem.stages.length === 0) {
        return { complete: false, reason: 'No stages' };
    }

    const stageWithoutOptions = caseItem.stages.find(s => s.options.length === 0);
    if (stageWithoutOptions) {
        return { complete: false, reason: `Stage ${stageWithoutOptions.stageOrder} has no options` };
    }

    const stageWithoutCorrect = caseItem.stages.find(s => !s.options.some(o => o.isCorrect));
    if (stageWithoutCorrect) {
        return { complete: false, reason: `Stage ${stageWithoutCorrect.stageOrder} missing correct option` };
    }

    return { complete: true };
}

interface AdminDashboardProps {
    userEmail: string;
    userId: string;
}

export default function AdminDashboard({ userEmail, userId }: AdminDashboardProps) {
    const [cases, setCases] = useState<Case[]>([]);
    const [creators, setCreators] = useState<CreatorOption[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState<AdminCasesQuery>({
        page: 1,
        pageSize: 25,
        creatorId: 'all',
        clinicalDomain: 'all',
        dateField: 'created',
        dateFrom: '',
        dateTo: '',
    });
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // View State
    const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);
    const [expandedStageId, setExpandedStageId] = useState<number | null>(null);

    // Edit States
    const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
    const [editingStageId, setEditingStageId] = useState<number | null>(null);
    const [editingOptionId, setEditingOptionId] = useState<number | null>(null);

    // Edit Forms
    const [editCaseForm, setEditCaseForm] = useState<EditCaseFormInput>({});
    const [editStageForm, setEditStageForm] = useState<EditStageFormInput>({});
    const [editOptionForm, setEditOptionForm] = useState<EditOptionFormInput>({});

    // Form States
    const [newCase, setNewCase] = useState<CaseFormInput>({
        title: '',
        description: '',
        clinicalDomain: '',
        difficultyLevel: '',
        userId: userId // Use actual Clerk user ID
    });

    const [newStage, setNewStage] = useState({
        narrative: '',
        clinicalData: '{\n  "BP": "120/80",\n  "HR": 75,\n  "RR": 16,\n  "Temp": 37.0,\n  "SpO2": 98\n}',
    });

    const [newOption, setNewOption] = useState({
        text: '',
        isCorrect: false,
        scoreWeight: 0,
        feedback: ''
    });

    useEffect(() => {
        handleRefresh();
    }, []);

    const handleRefresh = async (override?: Partial<AdminCasesQuery>) => {
        setLoading(true);
        try {
            const nextQuery = { ...query, ...override };
            const data = await getAdminCases({
                page: nextQuery.page,
                pageSize: nextQuery.pageSize,
                creatorId: nextQuery.creatorId === 'all' ? undefined : nextQuery.creatorId,
                clinicalDomain: nextQuery.clinicalDomain === 'all' ? undefined : nextQuery.clinicalDomain,
                dateField: nextQuery.dateField,
                dateFrom: nextQuery.dateFrom || undefined,
                dateTo: nextQuery.dateTo || undefined,
            });

            if (data) {
                setCases(data.cases as unknown as Case[]);
                setCreators(data.filterOptions.creators as CreatorOption[]);
                setCategories(data.filterOptions.categories);
                setTotalItems(data.pagination.totalItems);
                setTotalPages(data.pagination.totalPages);
                setQuery((prev) => ({
                    ...prev,
                    ...nextQuery,
                    page: data.pagination.page,
                    pageSize: data.pagination.pageSize,
                }));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = async () => {
        await handleRefresh({ page: 1 });
    };

    const clearFilters = async () => {
        await handleRefresh({
            page: 1,
            creatorId: 'all',
            clinicalDomain: 'all',
            dateField: 'created',
            dateFrom: '',
            dateTo: '',
        });
    };

    const handleGenerateClinicalData = async (narrative: string, target: 'new' | 'edit') => {
        if (!narrative) {
            alert("Please enter a narrative first.");
            return;
        }
        setLoading(true);
        const res = await generateClinicalDataAction(narrative);
        if (res.success) {
            const jsonString = JSON.stringify(res.data, null, 2);
            if (target === 'new') {
                setNewStage(prev => ({ ...prev, clinicalData: jsonString }));
            } else {
                setEditStageForm(prev => ({ ...prev, clinicalData: jsonString }));
            }
        } else {
            alert("Failed to generate clinical data: " + res.message);
        }
        setLoading(false);
    };

    const handleCreateCase = async () => {
        if (!isDifficultyLevel(newCase.difficultyLevel)) {
            alert('Please select a valid difficulty level');
            return;
        }
        setLoading(true);
        const res = await createCase({ ...newCase, difficultyLevel: newCase.difficultyLevel });
        if (res.success) {
            setNewCase({ title: '', description: '', clinicalDomain: '', difficultyLevel: '', userId });
            await handleRefresh();
            setExpandedCaseId(res.caseId!);
        } else {
            alert(res.message);
        }
        setLoading(false);
    };

    const handleCreateStage = async (caseId: number, currentStagesCount: number) => {
        setLoading(true);
        const res = await createStage({
            caseId,
            stageOrder: currentStagesCount + 1,
            narrative: newStage.narrative,
            clinicalData: newStage.clinicalData,
        });
        if (res.success) {
            setNewStage({ narrative: '', clinicalData: '{\n  "BP": "120/80",\n  "HR": 75,\n  "RR": 16,\n  "Temp": 37.0,\n  "SpO2": 98\n}' });
            await handleRefresh();
            setExpandedStageId(res.stageId!);
        } else {
            alert(res.message);
        }
        setLoading(false);
    };

    const handleCreateOption = async (stageId: number) => {
        setLoading(true);
        const res = await createOption({
            stageId,
            ...newOption
        });
        if (res.success) {
            setNewOption({ text: '', isCorrect: false, scoreWeight: 0, feedback: '' });
            await handleRefresh();
        } else {
            alert(res.message);
        }
        setLoading(false);
    };

    const handleDeleteCase = async (id: number) => {
        if (!confirm('Are you sure you want to delete this case?')) return;
        setLoading(true);
        await deleteCase(id);
        await handleRefresh();
        setLoading(false);
    };

    const handleTogglePublish = async (id: number, currentStatus: boolean) => {
        setLoading(true);
        const res = await togglePublish(id, !currentStatus);
        if (res.success) {
            await handleRefresh();
        } else {
            alert(res.message);
        }
        setLoading(false);
    };

    // ===== UPDATE HANDLERS =====
    const startEditCase = (caseItem: Case) => {
        setEditingCaseId(caseItem.id);
        setEditCaseForm({
            id: caseItem.id,
            title: caseItem.title,
            description: caseItem.description,
            clinicalDomain: caseItem.clinicalDomain,
            difficultyLevel: caseItem.difficultyLevel,
            verificationStatus: (caseItem.verificationStatus as VerificationStatus | undefined) || 'draft',
            qualityScore: caseItem.qualityScore || 0,
            rigourScore: caseItem.rigourScore || 0,
        });
    };

    const saveCase = async () => {
        if (
            editCaseForm.id === undefined ||
            !editCaseForm.title ||
            !editCaseForm.description ||
            !editCaseForm.clinicalDomain ||
            !editCaseForm.difficultyLevel
        ) {
            alert('Please fill all required fields before saving');
            return;
        }
        setLoading(true);
        const res = await updateCase({
            id: editCaseForm.id,
            title: editCaseForm.title,
            description: editCaseForm.description,
            clinicalDomain: editCaseForm.clinicalDomain,
            difficultyLevel: editCaseForm.difficultyLevel,
            verificationStatus: editCaseForm.verificationStatus,
            qualityScore: editCaseForm.qualityScore,
            rigourScore: editCaseForm.rigourScore,
        });
        if (res.success) {
            setEditingCaseId(null);
            await handleRefresh();
        } else {
            alert(res.message);
        }
        setLoading(false);
    };

    const cancelEditCase = () => {
        setEditingCaseId(null);
        setEditCaseForm({});
    };

    const startEditStage = (stage: Stage) => {
        setEditingStageId(stage.id);
        setEditStageForm({
            id: stage.id,
            narrative: stage.narrative,
            clinicalData: typeof stage.clinicalData === 'string'
                ? stage.clinicalData
                : JSON.stringify(stage.clinicalData, null, 2),
            mediaUrl: stage.mediaUrl,
        });
    };

    const saveStage = async () => {
        if (
            editStageForm.id === undefined ||
            !editStageForm.narrative ||
            editStageForm.clinicalData === undefined
        ) {
            alert('Please fill all required stage fields before saving');
            return;
        }
        setLoading(true);
        const res = await updateStage({
            id: editStageForm.id,
            narrative: editStageForm.narrative,
            clinicalData: editStageForm.clinicalData,
            mediaUrl: editStageForm.mediaUrl,
        });
        if (res.success) {
            setEditingStageId(null);
            await handleRefresh();
        } else {
            alert(res.message);
        }
        setLoading(false);
    };

    const cancelEditStage = () => {
        setEditingStageId(null);
        setEditStageForm({});
    };

    const handleDeleteStage = async (id: number) => {
        if (!confirm('Are you sure you want to delete this stage?')) return;
        setLoading(true);
        await deleteStage(id);
        await handleRefresh();
        setLoading(false);
    };

    const startEditOption = (option: Option) => {
        setEditingOptionId(option.id);
        setEditOptionForm({
            id: option.id,
            text: option.text,
            isCorrect: option.isCorrect,
            scoreWeight: option.scoreWeight,
            feedback: option.feedback,
        });
    };

    const saveOption = async () => {
        if (
            editOptionForm.id === undefined ||
            !editOptionForm.text ||
            editOptionForm.isCorrect === undefined ||
            editOptionForm.scoreWeight === undefined ||
            !editOptionForm.feedback
        ) {
            alert('Please fill all required option fields before saving');
            return;
        }
        setLoading(true);
        const res = await updateOption({
            id: editOptionForm.id,
            text: editOptionForm.text,
            isCorrect: editOptionForm.isCorrect,
            scoreWeight: editOptionForm.scoreWeight,
            feedback: editOptionForm.feedback,
        });
        if (res.success) {
            setEditingOptionId(null);
            await handleRefresh();
        } else {
            alert(res.message);
        }
        setLoading(false);
    };

    const cancelEditOption = () => {
        setEditingOptionId(null);
        setEditOptionForm({});
    };

    const handleDeleteOption = async (id: number) => {
        if (!confirm('Are you sure you want to delete this option?')) return;
        setLoading(true);
        await deleteOption(id);
        await handleRefresh();
        setLoading(false);
    };

    return (
        <div className="min-h-screen p-8 bg-muted/10 space-y-8 pb-32">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Scenario Builder</h1>
                    <p className="text-muted-foreground">Design and edit clinical simulation cases with full control.</p>
                    <div className="mt-3">
                        <Link href="/admin/ukmla" className="text-sm text-primary hover:underline">
                            Open UKMLA Question Bank →
                        </Link>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-medium">Admin Access</p>
                    <p className="text-xs text-muted-foreground font-mono">{userEmail}</p>
                </div>
            </header>

            {/* CREATE NEW CASE CARD */}
            <Card className="border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                        <Sparkles className="h-5 w-5" /> Create New Case
                    </CardTitle>
                    <CardDescription>
                        Describe the scenario and let AI build the case structure, or create a blank case manually.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Scenario Description</Label>
                        <Textarea
                            placeholder="Describe the clinical scenario. E.g. 'A 25 year old female with acute asthma exacerbation not responding to salbutamol. Include blood gas analysis.'"
                            value={newCase.description}
                            onChange={e => setNewCase({ ...newCase, description: e.target.value })}
                            className="min-h-[100px] bg-background"
                        />
                        <p className="text-xs text-muted-foreground">The AI will use this description to generate the Title, Narrative, Clinical Data, and Options.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Clinical Domain</Label>
                            <Input
                                placeholder="(Optional) e.g. Respiratory, or leave blank for Auto-detect"
                                value={newCase.clinicalDomain}
                                onChange={e => setNewCase({ ...newCase, clinicalDomain: e.target.value })}
                                className="bg-background"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Difficulty</Label>
                            <Select
                                value={newCase.difficultyLevel || "auto"} // Default to auto for display
                                onValueChange={(val) => setNewCase({ ...newCase, difficultyLevel: val as DifficultyLevel | 'auto' })}
                            >
                                <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Auto-detect (AI)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">✨ Auto-detect (AI)</SelectItem>
                                    <SelectItem value="Foundation">Foundation</SelectItem>
                                    <SelectItem value="Core">Core</SelectItem>
                                    <SelectItem value="Advanced">Advanced</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="pt-2">
                        <Label className="text-xs text-muted-foreground mb-2 block">Optional Overrides (for manual creation)</Label>
                        <div className="space-y-2">
                            <Input
                                placeholder="Case Title (Optional for AI, Required for Manual)"
                                value={newCase.title}
                                onChange={e => setNewCase({ ...newCase, title: e.target.value })}
                                className="bg-background"
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex gap-3 justify-between">
                    <Button
                        onClick={async () => {
                            setLoading(true);
                            // If title is provided, append it to prompt for better context
                            const prompt = newCase.title
                                ? `Title: ${newCase.title}. ${newCase.description}`
                                : newCase.description;

                            // Pass 'auto' or empty string to backend, it will handle it (or we should clean it here)
                            const domain = newCase.clinicalDomain || '';
                            const difficulty = newCase.difficultyLevel === 'auto' ? '' : newCase.difficultyLevel;

                            const res = await generateCaseAction(domain, difficulty, prompt);
                            if (res.success && res.caseId) {
                                await handleRefresh();
                                setExpandedCaseId(res.caseId);
                                setNewCase({ ...newCase, title: '', description: '', clinicalDomain: '', difficultyLevel: '' });
                                // Scroll to the new case
                                setTimeout(() => {
                                    const element = document.getElementById(`case-${res.caseId}`);
                                    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 500);
                            } else {
                                alert('Generation Error: ' + res.message);
                            }
                            setLoading(false);
                        }}
                        disabled={loading || !newCase.description}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1"
                    >
                        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bot className="h-4 w-4 mr-2" />}
                        Generate with AI
                    </Button>

                    <div className="w-px bg-indigo-200 dark:bg-indigo-800 mx-2"></div>

                    <Button
                        variant="outline"
                        onClick={handleCreateCase}
                        disabled={loading || !newCase.title || !newCase.clinicalDomain || !newCase.difficultyLevel || newCase.difficultyLevel === 'auto'}
                        className="flex-1"
                    >
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Create Blank Case
                    </Button>
                </CardFooter>
            </Card>

            <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <h2 className="text-xl font-semibold">Existing Cases ({totalItems})</h2>
                    <div className="text-xs text-muted-foreground">
                        Page {query.page} of {Math.max(totalPages, 1)} • {query.pageSize} per page
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Case Filters</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                            <Label>Creator</Label>
                            <Select
                                value={query.creatorId}
                                onValueChange={(val) => setQuery((prev) => ({ ...prev, creatorId: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All creators" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All creators</SelectItem>
                                    {creators.map((creator) => (
                                        <SelectItem key={creator.id} value={creator.id}>
                                            {creator.firstName
                                                ? `${creator.firstName} ${creator.lastName || ''} (${creator.email})`
                                                : creator.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                                value={query.clinicalDomain}
                                onValueChange={(val) => setQuery((prev) => ({ ...prev, clinicalDomain: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All categories</SelectItem>
                                    {categories.map((category) => (
                                        <SelectItem key={category} value={category}>
                                            {category}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Date field</Label>
                            <Select
                                value={query.dateField}
                                onValueChange={(val: 'created' | 'modified') => setQuery((prev) => ({ ...prev, dateField: val }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="created">Created date</SelectItem>
                                    <SelectItem value="modified">Modified date</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Cases per page</Label>
                            <Select
                                value={String(query.pageSize)}
                                onValueChange={(val) => setQuery((prev) => ({ ...prev, pageSize: Number(val) }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>From</Label>
                            <Input
                                type="date"
                                value={query.dateFrom}
                                onChange={(e) => setQuery((prev) => ({ ...prev, dateFrom: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>To</Label>
                            <Input
                                type="date"
                                value={query.dateTo}
                                onChange={(e) => setQuery((prev) => ({ ...prev, dateTo: e.target.value }))}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                        <Button onClick={applyFilters} disabled={loading}>
                            Apply Filters
                        </Button>
                        <Button variant="outline" onClick={clearFilters} disabled={loading}>
                            Reset
                        </Button>
                    </CardFooter>
                </Card>

                {cases.length === 0 ? (
                    <Card>
                        <CardContent className="py-10 text-center text-muted-foreground">
                            No cases found for the selected filters.
                        </CardContent>
                    </Card>
                ) : cases.map((c) => (
                    <Card key={c.id} id={`case-${c.id}`} className="overflow-hidden border-l-4 border-l-primary/50">
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setExpandedCaseId(expandedCaseId === c.id ? null : c.id)}
                        >
                            <div className="flex items-center gap-3 flex-1">
                                {expandedCaseId === c.id ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                                        {c.title}
                                        <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{c.clinicalDomain}</span>
                                        <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                            Rigour: {c.rigourScore || 0}/100
                                        </span>
                                    </h3>
                                    <p className="text-sm text-muted-foreground">{c.description}</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                                        <span className="flex items-center gap-1">
                                            <span className="font-medium">Created by:</span> {c.user?.firstName ? `${c.user.firstName} ${c.user.lastName || ''}` : (c.user?.email || 'Unknown')}
                                        </span>
                                        <span>•</span>
                                        <span>Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                                        <span>Updated: {new Date(c.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {(() => {
                                    const completionStatus = isCaseComplete(c);
                                    return (
                                        <>
                                            {completionStatus.complete ? (
                                                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-1">
                                                    ✓ Complete
                                                </span>
                                            ) : (
                                                <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-1" title={completionStatus.reason}>
                                                    ⚠ {completionStatus.reason}
                                                </span>
                                            )}
                                        </>
                                    );
                                })()}
                                <span className={`text-xs px-2 py-1 rounded-full ${c.isPublished ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                                    {c.isPublished ? 'Published' : 'Draft'}
                                </span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => { e.stopPropagation(); startEditCase(c); }}
                                    title="Edit case details"
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`h-8 w-8 p-0 ${c.isPublished ? 'text-yellow-600 hover:text-yellow-700' : 'text-green-600 hover:text-green-700'}`}
                                    onClick={(e) => { e.stopPropagation(); handleTogglePublish(c.id, c.isPublished); }}
                                    title={
                                        !c.isPublished && !isCaseComplete(c).complete
                                            ? `Cannot publish: ${isCaseComplete(c).reason}`
                                            : c.isPublished
                                                ? 'Unpublish (hide from students)'
                                                : 'Publish (show to all students)'
                                    }
                                    disabled={!c.isPublished && !isCaseComplete(c).complete}
                                >
                                    {c.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleDeleteCase(c.id); }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* EDIT CASE FORM */}
                        {editingCaseId === c.id && (
                            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-6 border-t border-blue-300 dark:border-blue-800">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">Edit Case Details</h4>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={saveCase} disabled={loading}>
                                            <Save className="h-4 w-4 mr-2" /> Save Changes
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={cancelEditCase}>
                                            <X className="h-4 w-4 mr-2" /> Cancel
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Title</Label>
                                        <Input
                                            value={editCaseForm.title}
                                            onChange={e => setEditCaseForm({ ...editCaseForm, title: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Clinical Domain</Label>
                                        <Input
                                            value={editCaseForm.clinicalDomain}
                                            onChange={e => setEditCaseForm({ ...editCaseForm, clinicalDomain: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Description</Label>
                                        <Textarea
                                            value={editCaseForm.description}
                                            onChange={e => setEditCaseForm({ ...editCaseForm, description: e.target.value })}
                                            className="min-h-[80px]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Difficulty Level</Label>
                                        <Select
                                            value={editCaseForm.difficultyLevel}
                                            onValueChange={(val: DifficultyLevel) => setEditCaseForm({ ...editCaseForm, difficultyLevel: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Foundation">Foundation</SelectItem>
                                                <SelectItem value="Core">Core</SelectItem>
                                                <SelectItem value="Advanced">Advanced</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Verification Status</Label>
                                        <Select
                                            value={editCaseForm.verificationStatus || 'draft'}
                                            onValueChange={(val) => setEditCaseForm({ ...editCaseForm, verificationStatus: val as VerificationStatus })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="draft">Draft</SelectItem>
                                                <SelectItem value="verified">Verified</SelectItem>
                                                <SelectItem value="rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Quality Score (0-100)</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={editCaseForm.qualityScore || 0}
                                            onChange={e => setEditCaseForm({ ...editCaseForm, qualityScore: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                            ⭐ Rigour Score (0-100)
                                            <span className="text-xs font-normal text-muted-foreground">(Human expert assessment)</span>
                                        </Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={editCaseForm.rigourScore || 0}
                                            onChange={e => setEditCaseForm({ ...editCaseForm, rigourScore: parseInt(e.target.value) || 0 })}
                                            className="border-purple-300 dark:border-purple-700"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {expandedCaseId === c.id && editingCaseId !== c.id && (
                            <div className="bg-muted/10 p-6 border-t animate-in fade-in zoom-in-95 duration-200">
                                {/* STAGES */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Stages ({c.stages.length})</h4>
                                    </div>

                                    {/* Existing Stages */}
                                    <div className="space-y-4 pl-1">
                                        {c.stages.map((stage) => (
                                            <Card key={stage.id} className="border-border/60">
                                                <div
                                                    className="p-3 flex items-center gap-2 cursor-pointer hover:text-primary transition-colors bg-card rounded-t-lg"
                                                    onClick={() => setExpandedStageId(expandedStageId === stage.id ? null : stage.id)}
                                                >
                                                    {expandedStageId === stage.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                    <span className="font-medium">Stage {stage.stageOrder}</span>
                                                    <span className="text-muted-foreground mx-2">•</span>
                                                    <span className="text-sm text-muted-foreground line-clamp-1 flex-1">{stage.narrative}</span>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        onClick={(e) => { e.stopPropagation(); startEditStage(stage); }}
                                                        title="Edit stage"
                                                    >
                                                        <Edit className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 text-destructive"
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteStage(stage.id); }}
                                                        title="Delete stage"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>

                                                {/* EDIT STAGE FORM */}
                                                {editingStageId === stage.id && (
                                                    <div className="p-4 border-t bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h5 className="font-semibold text-sm text-amber-900 dark:text-amber-100">Edit Stage {stage.stageOrder}</h5>
                                                            <div className="flex gap-2">
                                                                <Button size="sm" onClick={saveStage} disabled={loading}>
                                                                    <Save className="h-3 w-3 mr-2" /> Save
                                                                </Button>
                                                                <Button size="sm" variant="outline" onClick={cancelEditStage}>
                                                                    <X className="h-3 w-3 mr-2" /> Cancel
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="grid gap-4">
                                                            <div className="space-y-2">
                                                                <Label>Narrative</Label>
                                                                <Textarea
                                                                    value={editStageForm.narrative}
                                                                    onChange={e => setEditStageForm({ ...editStageForm, narrative: e.target.value })}
                                                                    className="min-h-[100px]"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between items-center">
                                                                    <Label>Clinical Data (JSON)</Label>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                                        onClick={() => handleGenerateClinicalData(editStageForm.narrative || '', 'edit')}
                                                                        disabled={loading || !editStageForm.narrative}
                                                                        type="button"
                                                                    >
                                                                        <Sparkles className="h-3 w-3 mr-1" /> Suggest from Narrative
                                                                    </Button>
                                                                </div>
                                                                <Textarea
                                                                    value={typeof editStageForm.clinicalData === 'string' ? editStageForm.clinicalData : JSON.stringify(editStageForm.clinicalData, null, 2)}
                                                                    onChange={e => setEditStageForm({ ...editStageForm, clinicalData: e.target.value })}
                                                                    className="min-h-[120px] font-mono text-xs"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Media URL (optional)</Label>
                                                                <Input
                                                                    value={editStageForm.mediaUrl || ''}
                                                                    onChange={e => setEditStageForm({ ...editStageForm, mediaUrl: e.target.value })}
                                                                    placeholder="https://..."
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {expandedStageId === stage.id && editingStageId !== stage.id && (
                                                    <div className="p-4 border-t space-y-6 bg-card/50">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                            <div className="space-y-1">
                                                                <Label className="text-muted-foreground">Narrative</Label>
                                                                <p className="p-2 rounded bg-muted/30 border">{stage.narrative}</p>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-muted-foreground">Clinical Data</Label>
                                                                <pre className="text-xs bg-muted p-2 rounded overflow-auto h-24 border">{JSON.stringify(stage.clinicalData, null, 2)}</pre>
                                                            </div>
                                                        </div>

                                                        <Separator />

                                                        {/* OPTIONS */}
                                                        <div>
                                                            <h5 className="text-sm font-semibold mb-3 flex items-center gap-2"><MessageSquare className="h-3 w-3" /> Options ({stage.options.length})</h5>
                                                            <div className="space-y-2 mb-4">
                                                                {stage.options.map(opt => (
                                                                    <div key={opt.id}>
                                                                        {editingOptionId === opt.id ? (
                                                                            <div className="p-4 rounded-md border bg-green-50/50 dark:bg-green-950/20 border-green-300 dark:border-green-800">
                                                                                <div className="flex items-center justify-between mb-3">
                                                                                    <h6 className="font-semibold text-sm text-green-900 dark:text-green-100">Edit Option</h6>
                                                                                    <div className="flex gap-2">
                                                                                        <Button size="sm" onClick={saveOption} disabled={loading}>
                                                                                            <Save className="h-3 w-3 mr-1" /> Save
                                                                                        </Button>
                                                                                        <Button size="sm" variant="outline" onClick={cancelEditOption}>
                                                                                            <X className="h-3 w-3 mr-1" /> Cancel
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="grid gap-3">
                                                                                    <div className="space-y-2">
                                                                                        <Label>Option Text</Label>
                                                                                        <Input
                                                                                            value={editOptionForm.text}
                                                                                            onChange={e => setEditOptionForm({ ...editOptionForm, text: e.target.value })}
                                                                                        />
                                                                                    </div>
                                                                                    <div className="space-y-2">
                                                                                        <Label>Feedback</Label>
                                                                                        <Textarea
                                                                                            value={editOptionForm.feedback}
                                                                                            onChange={e => setEditOptionForm({ ...editOptionForm, feedback: e.target.value })}
                                                                                            className="min-h-[60px]"
                                                                                        />
                                                                                    </div>
                                                                                    <div className="flex gap-4 items-center">
                                                                                        <div className="space-y-2">
                                                                                            <Label>Score Weight</Label>
                                                                                            <Input
                                                                                                type="number"
                                                                                                className="w-24"
                                                                                                value={editOptionForm.scoreWeight}
                                                                                                onChange={e => setEditOptionForm({ ...editOptionForm, scoreWeight: parseInt(e.target.value) || 0 })}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2 border px-3 py-2 rounded-md bg-background">
                                                                                            <Checkbox
                                                                                                id={`edit-correct-${opt.id}`}
                                                                                                checked={editOptionForm.isCorrect}
                                                                                                onCheckedChange={checked => setEditOptionForm({ ...editOptionForm, isCorrect: checked as boolean })}
                                                                                            />
                                                                                            <Label htmlFor={`edit-correct-${opt.id}`} className="cursor-pointer">Is Correct</Label>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className={`p-3 rounded-md border text-sm flex justify-between items-center ${opt.isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                                                                <div className="space-y-1 flex-1">
                                                                                    <div className="font-medium">{opt.text} <span className="text-xs text-muted-foreground ml-2">({opt.scoreWeight} pts)</span></div>
                                                                                    <div className="text-xs italic text-muted-foreground">{opt.feedback}</div>
                                                                                </div>
                                                                                <div className="flex gap-1">
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="ghost"
                                                                                        className="h-7 w-7 p-0"
                                                                                        onClick={() => startEditOption(opt)}
                                                                                    >
                                                                                        <Edit className="h-3 w-3" />
                                                                                    </Button>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="ghost"
                                                                                        className="h-7 w-7 p-0 text-destructive"
                                                                                        onClick={() => handleDeleteOption(opt.id)}
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Add Option Form */}
                                                            <div className="bg-muted/30 p-4 rounded-md border border-dashed text-sm space-y-4">
                                                                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Add New Option</p>
                                                                <div className="grid gap-3">
                                                                    <div className="space-y-2">
                                                                        <Label>Option Text</Label>
                                                                        <Input
                                                                            placeholder="Action or decision..."
                                                                            value={newOption.text}
                                                                            onChange={e => setNewOption({ ...newOption, text: e.target.value })}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label>Feedback</Label>
                                                                        <Input
                                                                            placeholder="Explanation of why this choice..."
                                                                            value={newOption.feedback}
                                                                            onChange={e => setNewOption({ ...newOption, feedback: e.target.value })}
                                                                        />
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-6 mt-2 items-center">
                                                                        <div className="flex items-center gap-2">
                                                                            <Label>Score</Label>
                                                                            <Input
                                                                                type="number"
                                                                                className="w-20"
                                                                                value={newOption.scoreWeight}
                                                                                onChange={e => setNewOption({ ...newOption, scoreWeight: parseInt(e.target.value) || 0 })}
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center gap-2 border px-3 py-2 rounded-md bg-background">
                                                                            <Checkbox
                                                                                id="isCorrect"
                                                                                checked={newOption.isCorrect}
                                                                                onCheckedChange={checked => setNewOption({ ...newOption, isCorrect: checked as boolean })}
                                                                            />
                                                                            <Label htmlFor="isCorrect" className="cursor-pointer">Is Correct Answer</Label>
                                                                        </div>
                                                                        <Button size="sm" onClick={() => handleCreateOption(stage.id)} disabled={loading || !newOption.text} className="ml-auto">Add Option</Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </Card>
                                        ))}
                                    </div>

                                    {/* ADD STAGE FORM */}
                                    <div className="mt-8 pt-8 border-t">
                                        <h4 className="font-semibold mb-4 flex items-center gap-2"><Plus className="h-4 w-4" /> Add New Stage</h4>
                                        <div className="grid gap-4 bg-background p-4 rounded-lg border">
                                            <div className="space-y-2">
                                                <Label>Narrative</Label>
                                                <Textarea
                                                    className="min-h-[100px]"
                                                    placeholder="Stage narrative..."
                                                    value={newStage.narrative}
                                                    onChange={e => setNewStage({ ...newStage, narrative: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <Label>Clinical Data (JSON)</Label>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                        onClick={() => handleGenerateClinicalData(newStage.narrative, 'new')}
                                                        disabled={loading || !newStage.narrative}
                                                        type="button"
                                                    >
                                                        <Sparkles className="h-3 w-3 mr-1" /> Suggest from Narrative
                                                    </Button>
                                                </div>
                                                <Textarea
                                                    className="min-h-[120px] font-mono text-xs"
                                                    value={newStage.clinicalData}
                                                    onChange={e => setNewStage({ ...newStage, clinicalData: e.target.value })}
                                                />
                                            </div>
                                            <Button onClick={() => handleCreateStage(c.id, c.stages.length)} disabled={loading || !newStage.narrative} variant="secondary">
                                                Add Stage {c.stages.length + 1}
                                            </Button>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )}
                    </Card>
                ))}

                {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <p className="text-sm text-muted-foreground">
                            Showing {(query.page - 1) * query.pageSize + 1} to {Math.min(query.page * query.pageSize, totalItems)} of {totalItems}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRefresh({ page: query.page - 1 })}
                                disabled={loading || query.page <= 1}
                            >
                                Previous
                            </Button>
                            <span className="text-sm">
                                {query.page} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRefresh({ page: query.page + 1 })}
                                disabled={loading || query.page >= totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
