"use client"

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import React from 'react'

const NewProjectButton = () => {
    return (
        <Button
            size={"lg"}
            className='rounded-lg font-semibold'
            onClick={() => { }}
        >
            <Plus />
            New Project
        </Button>
    )
}

export default NewProjectButton