"use client"
import React from 'react'
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar"
import { User } from '@/generated/prisma'
import { Button } from "@/components/ui/button"

const NavFooter = ({ user }: { user: User }) => {

    const [loading, setLoading] = React.useState(false)

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <div className='flex flex-col gap-y-6 items-start group-data-[collapsible=icon]:hidden shadow-sm '>
                    {!user.subscription && (
                        <div className='flex flex-col items-start p-2 pb-3 gap-4 bg-background-80 rounded-xl'>
                            <div className='flex flex-col items-start gap-1'>
                                <p className='text-base font-bold'>
                                    Get
                                    <span className='text-trpp'> Billing</span>
                                </p>
                                <span className='text-sm dark:text-primary'>Unlock all features including custom domains</span>
                            </div>
                            <div className='w-full bg-trpp-gradient p-[1px] rounded-full'>
                                <Button
                                    className='w-full border bg-background-80 hover:bg-background-90 text-primary rounded-full font-bold text-center'

                                    variant="default"
                                    size={"lg"}
                                // onClick={() => router.push("/dashboard/billing")}
                                >
                                    {loading ? 'Upgrading...' : 'Upgrade'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}

export default NavFooter