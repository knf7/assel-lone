import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Customer {
    id: number;
    name: string;
    national_id: string;
    mobile_number: string;
    email?: string;
    workplace?: string;
    salary?: number;
    credit_score?: number;
    created_at: string;
}

export function useCustomers() {
    return useQuery({
        queryKey: ['customers'],
        queryFn: async (): Promise<Customer[]> => {
            const { data } = await api.get('/customers');
            return data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
