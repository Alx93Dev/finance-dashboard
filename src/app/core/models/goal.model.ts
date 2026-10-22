/** Something the user is saving towards, with what they have set aside so far. */
export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  /** Optional date ('YYYY-MM-DD') to reach the target by. */
  deadline: string | null;
}
