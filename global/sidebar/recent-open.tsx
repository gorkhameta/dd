import React from 'react'
import { Projects } from '@/generated/prisma'
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { toast } from 'sonner'

type Props = {
    recentProjects: Projects[]
}

const RecentOpen = ({ recentProjects }: Props) => {

    const handleClick = (projectId: string, slides: string) => {

        if (!projectId || !slides) {
            toast.error("Project not found", {
                description: "Please try again",
                style: { backgroundColor: 'red' }
            })
            return
        }

        window.location.href = `/projects/${projectId}/${slides}`
    }

    return (
        recentProjects.length > 0 ? (<SidebarGroup>
            <SidebarGroupLabel>Recent Opened</SidebarGroupLabel>
            <SidebarMenu>
                {recentProjects.length > 0 ?
                    recentProjects.map((item) => (

                        <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                                asChild
                                tooltip={item.title}
                                className='hover:bg-muted'
                            >
                                <Button
                                    onClick={() => handleClick(item.id, item.slides)}
                                    className='text-xs items-center justify-start'
                                    variant={'link'}
                                >
                                    <span>{item.title}</span>
                                </Button>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))
                    : ''}
            </SidebarMenu>
        </SidebarGroup>) : (
            <></>
        )

    )
}

export default RecentOpen