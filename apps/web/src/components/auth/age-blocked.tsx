/** Shown instead of the sign-up or age form once the age screen has turned someone away. */
export function AgeBlocked() {
  return (
    <div className="flex flex-col gap-2" role="status">
      <h1 className="font-display text-2xl font-bold tracking-tight">Sorry, you can’t join yet</h1>
      <p className="text-muted-foreground text-[15px]">
        You don’t meet the requirements to use Carza right now. We haven’t kept any of the details
        you entered.
      </p>
    </div>
  );
}
