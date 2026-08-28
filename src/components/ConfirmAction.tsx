"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmActionProps {
  onConfirm: () => void;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function ConfirmAction({ onConfirm, title, description, children }: ConfirmActionProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <span 
          onClick={(e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            setOpen(true); 
          }}
          className="inline-block cursor-pointer"
        >
          {children}
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
