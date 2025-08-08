import React from 'react'

type Props = {
    children: React.ReactNode
}

const layout = ({ children }: Props) => {
    return (
        <div className='bg-muted flex min-h-svh items-center justify-center flex-col p-6 md:p-10'>
            <div className="w-full max-w-sm md:max-w-3xl">
                {children}
            </div>
        </div>
    )
}

export default layout