import React from "react";
import CardRepo from "@/app/components/card-repo";
type Props = {
  id: number;
  owner_id: number;
  owner_email: string;
  name: string;
  description: string;
  is_private: boolean;
  default_branch: string;
  created_at: string;
  updated_at: string;
};

function Page({
  id,
  owner_email,
  is_private,
  owner_id,
  name,
  description,
  updated_at,
  default_branch,
  created_at,
  ...props
}: Props) {
  return (
    <div>
      <CardRepo />
    </div>
  );
}

export default Page;
