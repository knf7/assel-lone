'use client';

import { useParams } from 'next/navigation';
import { useLoanDetail } from '@/hooks/queries/useLoanDetail';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, CreditCard, Download, Activity } from 'lucide-react';
import Link from 'next/link';

export default function LoanDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const { data: loan, isLoading, isError } = useLoanDetail(id);

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <p className="text-slate-500">Loading loan schedule...</p>
            </div>
        );
    }

    if (isError || !loan) {
        return (
            <div className="flex flex-col gap-4 h-[400px] items-center justify-center">
                <p className="text-red-500">Failed to load loan details.</p>
                <Button variant="outline" asChild><Link href="/dashboard/loans">Return</Link></Button>
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Paid</Badge>;
            case 'overdue': return <Badge variant="destructive">Overdue</Badge>;
            case 'partial': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-500">Partial</Badge>;
            default: return <Badge variant="outline">Pending</Badge>;
        }
    };

    const totalPaid = loan.installments.reduce((acc, inst) => acc + Number(inst.paid_amount || 0), 0);
    const progressPercent = Math.min(100, Math.round((totalPaid / loan.total_amount) * 100));

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard/loans">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Loan #{loan.id}</h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            For customer: <Link href={`/dashboard/customers/${loan.customer_id}`} className="hover:underline font-medium text-primary">{loan.customer_name || `ID: ${loan.customer_id}`}</Link>
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export PDF
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1 border-slate-200 shadow-sm dark:border-slate-800">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Loan Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Total Principal</p>
                            <p className="text-3xl font-bold">﷼ {Number(loan.total_amount).toLocaleString()}</p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Term Length</span>
                                <span className="font-medium">{loan.months} Months</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Interest Rate</span>
                                <span className="font-medium">{loan.monthly_interest_rate}% / mo</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Status</span>
                                <span className="font-medium capitalize">{loan.status}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Start Date</span>
                                <span className="font-medium">{new Date(loan.start_date).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-medium">Progress</span>
                                <span className="font-medium">{progressPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5">
                                <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                            <p className="text-xs text-slate-500 mt-2 text-right">﷼ {totalPaid.toLocaleString()} paid</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Installments Timeline</CardTitle>
                        <CardDescription>Scheduled payments and tracking.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="pl-6 w-[80px]">#</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Amount (﷼)</TableHead>
                                        <TableHead>Paid (﷼)</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right pr-6">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loan.installments?.map((inst, index) => (
                                        <TableRow key={inst.id}>
                                            <TableCell className="pl-6 text-slate-500">{index + 1}</TableCell>
                                            <TableCell className="font-medium">
                                                {new Date(inst.due_date).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>{Number(inst.amount).toLocaleString()}</TableCell>
                                            <TableCell>{Number(inst.paid_amount || 0).toLocaleString()}</TableCell>
                                            <TableCell>{getStatusBadge(inst.status)}</TableCell>
                                            <TableCell className="text-right pr-6">
                                                {inst.status !== 'paid' && (
                                                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                                                        Pay
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
