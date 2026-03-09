'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCustomer } from '@/hooks/queries/useCustomer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Mail, Phone, CreditCard, User as UserIcon, Briefcase } from 'lucide-react';
import Link from 'next/link';

export default function CustomerProfilePage() {
    const params = useParams();
    const id = params.id as string;
    const { data: customer, isLoading, isError } = useCustomer(id);

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <p className="text-slate-500">Loading profile data...</p>
            </div>
        );
    }

    if (isError || !customer) {
        return (
            <div className="flex flex-col gap-4 h-[400px] items-center justify-center">
                <p className="text-red-500">Failed to load customer profile or customer not found.</p>
                <Button variant="outline" asChild><Link href="/dashboard/customers">Return</Link></Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard/customers">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            National ID: {customer.national_id}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <Edit className="h-4 w-4" />
                        Edit Profile
                    </Button>
                    <Button className="gap-2" asChild>
                        <Link href={`/dashboard/loans/new?customerId=${customer.id}`}>
                            <CreditCard className="h-4 w-4" />
                            New Loan
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Contact & Personal Information</CardTitle>
                        <CardDescription>Primary communication channels and CRM data.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <Phone className="h-4 w-4 text-slate-500" />
                                    <div>
                                        <p className="text-sm font-medium">Mobile</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">{customer.mobile_number}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Mail className="h-4 w-4 text-slate-500" />
                                    <div>
                                        <p className="text-sm font-medium">Email</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">{customer.email || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <UserIcon className="h-4 w-4 text-slate-500" />
                                    <div>
                                        <p className="text-sm font-medium">Demographics</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {customer.gender ? customer.gender + ' • ' : ''}
                                            {customer.marital_status || 'Status Unknown'}
                                            {customer.dependents ? ` • ${customer.dependents} Dependents` : ''}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <Briefcase className="h-4 w-4 text-slate-500" />
                                    <div>
                                        <p className="text-sm font-medium">Employment</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {customer.workplace || 'Unspecified'}
                                            {customer.salary ? ` • ﷼ ${Number(customer.salary).toLocaleString()}/mo` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <CreditCard className="h-4 w-4 text-slate-500" />
                                    <div>
                                        <p className="text-sm font-medium">Credit Score</p>
                                        <div>
                                            <Badge variant={customer.credit_score && customer.credit_score > 700 ? "default" : "secondary"}>
                                                {customer.credit_score || 'N/A'}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>System Metadata</CardTitle>
                        <CardDescription>Internal tracking info.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm font-medium">System ID</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">#{customer.id}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Registered On</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {new Date(customer.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Internal Notes</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                                {customer.notes || 'No notes available.'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
