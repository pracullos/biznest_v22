import { useState, type FormEvent } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'
import type { CityCreate } from '@networking/api/model/cityCreate'
import type { CityResponse } from '@networking/api/model/cityResponse'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Plus } from 'lucide-react'

interface CreateCityDialogProps {
  mutation: UseMutationResult<AxiosResponse<CityResponse>, unknown, CityCreate>
}

export function CreateCityDialog({ mutation }: CreateCityDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [province, setProvince] = useState('')
  const [region, setRegion] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await mutation.mutateAsync({ name, province: province || null, region: region || null })
    setOpen(false)
    setName('')
    setProvince('')
    setRegion('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-1.5" />
          Create City
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new city</DialogTitle>
          <DialogDescription>
            Add a city to the platform. You will be automatically assigned as its LGU admin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="city-name">City name <span className="text-destructive">*</span></Label>
            <Input
              id="city-name"
              placeholder="e.g. Cebu City"
              required
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="province">Province</Label>
            <Input
              id="province"
              placeholder="e.g. Cebu"
              value={province}
              onChange={e => setProvince(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              placeholder="e.g. Region VII"
              value={region}
              onChange={e => setRegion(e.target.value)}
            />
          </div>
          {mutation.isError && (
            <p className="text-sm text-destructive">
              Failed to create city. Please try again.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner className="mr-2 size-4" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
