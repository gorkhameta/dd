import z from "zod";

export const createOrganizationSchema = z.object({
    name: z.string().min(1, { message: 'Organization name is required' }), // Organization name
    size: z.string().min(1, { message: 'Organization size is required' }), // Organization size
    howHeard: z.string().min(1, { message: 'How you heard about us is required' }), // How did you hear about us
    firstName: z.string().min(1, { message: 'First name is required' }), // User's first name
    lastName: z.string().min(1, { message: 'Last name is required' }), // User's last name
});

export const sizeOptions = [
    { value: "1-10", label: "1-10" },
    { value: "11-50", label: "11-50" },
    { value: "51-200", label: "51-200" },
    { value: "201+", label: "201+" },
];

export const howHeardOptions = [
    { value: "social_media", label: "Social Media" },
    { value: "friend", label: "Friend" },
    { value: "search_engine", label: "Search Engine" },
    { value: "other", label: "Other" },
];