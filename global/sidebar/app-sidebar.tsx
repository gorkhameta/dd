"use client"

import { Project, User } from '@/generated/prisma'
import React from 'react'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { NavMain } from './nav-main'
import { data } from '@/lib/constants'
import RecentOpen from './recent-open'
import NavFooter from './nav-footer'




export const Appsidebar = ({ recentProjects, user, ...props }: {
    recentProjects: Project[]

} & { user?: User } & React.ComponentProps<typeof Sidebar>) => {
    return (
        <Sidebar
            collapsible='icon'
            className='max-w-[212px] bg-background-90'
            {...props}
        >
            <SidebarHeader className='pt-5.5  pb-0 '>
                <SidebarMenuButton className='data-[state-open]:text-sidebar-accent-foreground'
                    size={'lg'}
                >
                    <div className='flex aspect-square size-8 items-center justify-center rounded-lg texy-sidebar-primary-foreground'>
                        <Avatar className='h-10 w-10 rounded-full'>
                            <AvatarImage src="/logo.svg" alt='TrpP' />
                            <AvatarFallback className='rounded-lg'>
                                Tr
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    <span className='truncate text-primary text-3xl font-semibold'>
                        TrpP
                    </span>
                </SidebarMenuButton>
            </SidebarHeader>
            <SidebarContent className=' mt-10 gap-y-6'>
                <NavMain items={data.navMain.map(item => ({
                    title: item.name,
                    url: item.href,
                    icon: item.icon,
                    items: [], // add sub-items here later if needed
                }))} />
                <RecentOpen recentProjects={recentProjects} />
            </SidebarContent>
            <SidebarFooter>
                <NavFooter user={user} />
            </SidebarFooter>
        </Sidebar>
    )
}

