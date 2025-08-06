import { EarthIcon } from 'lucide-react'
import React from 'react'
import UFOImage from "@/components/icons/icon"

const NotFount = () => {
    return (
        <div className='flex flex-col min-h-[70vh] w-full justify-center items-center gap-12'>
            <UFOImage />
            <div className='flex flex-col items-center justify-center'>
                <p className='text-3xl font-semibold text-primary'>Nothing to see here</p>
                <p className='text-3xl font-semibold text-secondary'>So here is a rondom image genarated by me</p>
            </div>
        </div>
    )
}

export default NotFount