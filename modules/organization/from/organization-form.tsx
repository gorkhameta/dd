import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createOrganizationSchema,sizeOptions, howHeardOptions} from "@/modules/organization/schema";


export const OrganizationForm = () => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(false);

    const createOrganization = useMutation(
        trpc.organizations.create.mutationOptions({
            onMutate: () => setIsLoading(true),
            onSuccess: async () => {
                await queryClient.invalidateQueries(
                    trpc.organizations.getMany.queryOptions()
                );
                setIsLoading(false);
                router.push("/dashboard");
            },
            onError: (error) => {
                setIsLoading(false);
                toast.error(error.message);
            },
        })
    );

    const form = useForm<z.infer<typeof createOrganizationSchema>>({
        resolver: zodResolver(createOrganizationSchema),
        defaultValues: {
            name: "",
            firstName: "",
            lastName: "",
            size: "",
            howHeard: "",
        },
    });

    const onSubmit = (values: z.infer<typeof createOrganizationSchema>) => {
        createOrganization.mutate(values);
    };

    return (
        <Form {...form}>
            <form className="space-y-10" onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        name="firstName"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>First name</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="e.g. Jane" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        name="lastName"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Last name</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="e.g. Doe" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                    name="name"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Organization name</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="e.g. Acme Inc." />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    name="size"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Organization size</FormLabel>
                            <FormControl>
                                <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                >
                                    <FormControl className="w-full">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {sizeOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    name="howHeard"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>How did you hear about us?</FormLabel>
                            <FormControl>
                                <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                >
                                    <FormControl className="w-full">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {howHeardOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex justify-end">
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="size-4 animate-spin" />}
                        Continue to dashboard
                    </Button>
                </div>
            </form>
        </Form>
    );
};