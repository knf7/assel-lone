'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface DashboardMetrics {
    totalLoansAmount: number;
    totalPaidAmount: number;
    totalOverdueAmount: number;
    activeLoansCount: number;
    defaultedLoansCount: number;
    defaultRate: number;
    totalCustomersCount: number;
}

export interface CashFlowChartData {
    month: string;
    expected: number;
    actual_paid: number;
}

export interface DetailedReport {
    metrics: DashboardMetrics;
    cashFlow: CashFlowChartData[];
}

export function useAnalytics(period: 'month' | 'year' | 'all' = 'all') {
    return useQuery({
        queryKey: ['analytics', period],
        queryFn: async (): Promise<DetailedReport> => {
            // Assuming existing backend has an endpoint like /reports/detailed or /reports/dashboard
            // Modify URL if the actual endpoint differs
            const { data } = await api.get(`/reports/dashboard?period=${period}`);
            return data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
