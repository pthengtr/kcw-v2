import { UserType } from "./UserColumns";

type UserDetailProps = { currentUser: UserType | undefined };

export default function UserDetail({ currentUser }: UserDetailProps) {
  return <div className="p-4">{currentUser?.fullName}</div>;
}
