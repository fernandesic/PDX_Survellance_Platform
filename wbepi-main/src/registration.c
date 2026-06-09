#include <R.h>
#include <Rinternals.h>
#include <stdlib.h> // for NULL
#include <R_ext/Rdynload.h>

/* FIXME: 
   Check these declarations against the C/Fortran source code.
*/

/* .C calls */
extern void seirdv_rhs_dde(void *);

/* .Call calls */
extern SEXP seirdv_contents(SEXP);
extern SEXP seirdv_create(SEXP);
extern SEXP seirdv_initial_conditions(SEXP, SEXP);
extern SEXP seirdv_metadata(SEXP);
extern SEXP seirdv_rhs_r(SEXP, SEXP, SEXP);
extern SEXP seirdv_set_initial(SEXP, SEXP, SEXP, SEXP);
extern SEXP seirdv_set_user(SEXP, SEXP);

static const R_CMethodDef CEntries[] = {
    {"seirdv_rhs_dde", (DL_FUNC) &seirdv_rhs_dde, 1},
    {NULL, NULL, 0}
};

static const R_CallMethodDef CallEntries[] = {
    {"seirdv_contents",           (DL_FUNC) &seirdv_contents,           1},
    {"seirdv_create",             (DL_FUNC) &seirdv_create,             1},
    {"seirdv_initial_conditions", (DL_FUNC) &seirdv_initial_conditions, 2},
    {"seirdv_metadata",           (DL_FUNC) &seirdv_metadata,           1},
    {"seirdv_rhs_r",              (DL_FUNC) &seirdv_rhs_r,              3},
    {"seirdv_set_initial",        (DL_FUNC) &seirdv_set_initial,        4},
    {"seirdv_set_user",           (DL_FUNC) &seirdv_set_user,           2},
    {NULL, NULL, 0}
};

void R_init_wbepi(DllInfo *dll)
{
    R_registerRoutines(dll, CEntries, CallEntries, NULL, NULL);
    R_useDynamicSymbols(dll, FALSE);
}
