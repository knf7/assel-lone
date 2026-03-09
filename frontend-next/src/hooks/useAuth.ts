import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type ApiError = {
    response?: {
        status?: number;
        data?: {
            error?: string;
        };
    };
    message?: string;
};

export function useAuth() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // Login Mutation
    const loginMutation = useMutation({
        mutationFn: async (credentials: {
            identifier: string;
            password: string;
            rememberMe?: boolean;
        }) => {
            const { data } = await api.post('/auth/login', credentials);
            return data;
        },
        onSuccess: (data) => {
            if (data.requiresOTP) {
                toast('OTP Required. Please check your email.');
                return;
            }
            if (data.token) {
                localStorage.setItem('token', data.token);
            }
            if (data.user) {
                localStorage.setItem('merchant', JSON.stringify(data.user));
            }
            toast.success('Login successful!');
            queryClient.invalidateQueries({ queryKey: ['user'] });
            router.push('/dashboard');
        },
        onError: (error: unknown) => {
            const apiError = error as ApiError;
            const message =
                apiError.response?.data?.error ||
                (apiError.response?.status ? `Login failed (HTTP ${apiError.response.status}).` : '') ||
                apiError.message ||
                'Login failed. Please check credentials.';
            toast.error(message);
        },
    });

    // Register Mutation
    const registerMutation = useMutation({
        mutationFn: async (userData: {
            businessName: string;
            username: string;
            email: string;
            mobile: string;
            password: string;
        }) => {
            const { data } = await api.post('/auth/register', userData);
            return data;
        },
        onSuccess: () => {
            toast.success('Registration successful. You can log in now.');
            router.push('/login');
        },
        onError: (error: unknown) => {
            const apiError = error as ApiError;
            const message =
                apiError.response?.data?.error ||
                (apiError.response?.status ? `Registration failed (HTTP ${apiError.response.status}).` : '') ||
                apiError.message ||
                'Registration failed.';
            toast.error(message);
        },
    });

    return {
        login: loginMutation.mutate,
        isLoggingIn: loginMutation.isPending,
        loginData: loginMutation.data,
        register: registerMutation.mutate,
        isRegistering: registerMutation.isPending,
    };
}
