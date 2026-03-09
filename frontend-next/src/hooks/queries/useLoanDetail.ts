'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Installment {
    id: number;
    loan_id: number;
    amount: number;
    due_date: string;
    status: 'pending' | 'paid' | 'overdue' | 'partial';
    paid_amount: number;
}

export interface LoanDetail {
    id: number;
    customer_id: number;
    total_amount: number;
    monthly_interest_rate: number;
    months: number;
    start_date: string;
    status: 'active' | 'completed' | 'defaulted';
    customer_name?: string;
    installments: Installment[];
}

export function useLoanDetail(id: string) {
    return useQuery({
        queryKey: ['loan', id],
        queryFn: async (): Promise<LoanDetail> => {
            const { data } = await api.get(`/loans/${id}`);
            return data;
        },
        enabled: !!id,
    });
}
