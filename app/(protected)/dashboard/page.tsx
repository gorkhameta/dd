import NotFount from '@/global/not-found'
import React from 'react'

type Props = {}

const Dashboard = (props: Props) => {
    return (
        <div className='w-full flex flex-col gap-6 relative md:p-0 p-4'>
            <div className='flex flex-col-reverse items-start w-full gap-6 sm:flex-row sm:justify-between sm:items-center'>
                <div className='flex flex-col items-start'>
                    <h1 className='text-2xl font-semibold dark:text-primary'>
                        Projects
                    </h1>
                    <p className='text-base font-normal dark:text-primary'>all of your work in one place</p>
                </div>
            </div>
            {/* <Projects /> */}
            <NotFount />
        </div>
    )
}

export default Dashboard