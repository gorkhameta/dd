import { CheckCheckIcon, ClockIcon, HomeIcon, Settings } from "lucide-react";

export const data = {
    user: {
        name: "John Doe",
        image: "https://github.com/kevinthompson.png",
        avatar: "https://github.com/kevinthompson.png"
    },

    navMain: [
        {
            name: "Home",
            href: "/",
            icon: HomeIcon
        },
        {
            name: "Projects",
            href: "/projects",
            icon: ClockIcon
        },
        {
            name: "About",
            href: "/about",
            icon: CheckCheckIcon
        },
        {
            name: "Settings",
            href: "/settings",
            icon: Settings
        },
    ]
}