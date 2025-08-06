"use client"

import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { User } from '@/generated/prisma'
import React from 'react'
import SearchBar from './search-bar'
import ThemeSwitcher from './theme-swetch'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import NewProjectButton from './new-project-btn'

type Props = {
  user: User
}

const UpperInfoBar = ({ user }: Props) => {
  return (
    <header className='sticky top-0 z-[10] flex shrink-0 items-center bg-background py-3.5 border-b gap-4 pr-4'>
      {/* Left section - SidebarTrigger, Separator, and SearchBar together */}
      <div className='flex items-center gap-4 flex-1'>
        <SidebarTrigger />
        <Separator orientation='vertical' className='h-4' />
        <div className='w-[55%]'>
          <SearchBar />
        </div>
      </div>

      {/* Right section */}
      <div className='flex items-center gap-4'>
        <ThemeSwitcher />
        <Button className='bg-primary-80 rounded-lg hover:bg-background-80 text-primary font-semibold cursor-not-allowed'>
          <Upload />
          Import
        </Button>
        <NewProjectButton />
      </div>
    </header>
  )
}

export default UpperInfoBar