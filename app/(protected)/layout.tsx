
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import UpperInfoBar from '@/global/navbar/upper-info-bar'
import { Appsidebar } from '@/global/sidebar/app-sidebar'
import React from 'react'

type Props = {
    children: React.ReactNode
}
const Layout = ({ children }: Props) => {
    return (
        <div className='w-full min-h-screen'>
            <SidebarProvider>
                <Appsidebar recentProjects={[]} user={{}} />
                <SidebarInset>
                    <UpperInfoBar user={{}} />
                    {children}
                </SidebarInset>
            </SidebarProvider>
        </div>
    )
}

export default Layout