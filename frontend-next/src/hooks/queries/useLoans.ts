import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Loan {
    id: number;
    customer_id: number;
    total_amount: number;
    monthly_interest_rate: number;
    months: number;
    start_date: string;
    status: 'active' | 'completed' | 'defaulted';
    customer_name?: string; // Appended by backend joins usually
    created_at: string;
}

export function useLoans() {
    return useQuery({
        queryKey: ['loans'],
        queryFn: async (): Promise<Loan[]> => {
            const { data } = await api.get('/loans');
            return data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
