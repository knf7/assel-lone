'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Customer {
    id: number;
    merchant_id: number;
    name: string;
    national_id: string;
    mobile_number: string;
    email: string | null;
    gender: string | null;
    marital_status: string | null;
    dependents: number | null;
    workplace: string | null;
    salary: number | null;
    credit_score: number | null;
    address: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export function useCustomer(id: string) {
    return useQuery({
        queryKey: ['customer', id],
        queryFn: async (): Promise<Customer> => {
            const { data } = await api.get(`/customers/${id}`);
            return data;
        },
        enabled: !!id,
    });
}
