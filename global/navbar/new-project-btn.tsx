"use client"

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import React from 'react'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { OrganizationForm } from '@/modules/organization/from/organization-form'

const NewProjectButton = () => {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    // size={"lg"}
                    // className='rounded-lg font-semibold'
                    // onClick={() => { }}
                >
                    <Plus />
                    New Project
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Organization</DialogTitle>
                    <DialogDescription>
                        This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <OrganizationForm />
            </DialogContent>
        </Dialog>
    )
}

export default NewProjectButton