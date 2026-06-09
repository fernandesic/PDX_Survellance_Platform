#' Process delta: matrix of spatial diffusion
#'
#' @noRd
#' @author Thibaut Jombart
#' @param x A list of inputs for run_seirdv()

process_delta <- function(x) {
  ## delta: matrix of spatial diffusion, indicating the proportion of FOI going
  ## from populations (row) to populations (columns)
  ##
  ## note: this matrix needs to be row-standardized; if it is not provided, a
  ## matrix of uniform spatial diffusion towards outside populations is built for
  ## the user, with (1-diffusion) infections staying inside the patch

  if (is.null(x$delta)) {
    off_term <- x$diffusion / (x$n_populations - 1)
    x$delta <- matrix(off_term, ncol = x$n_populations, nrow = x$n_populations)
    diag(x$delta) <- 1 - x$diffusion
  }
  stopifnot(
    is.numeric(x$delta),
    nrow(x$delta) == x$n_populations,
    ncol(x$delta) == x$n_populations,
    all(is.finite(x$delta)),
    all(x$delta >= 0)
  )
  x$delta <- prop.table(x$delta, 1L)
  stopifnot(all(is.finite(x$delta)))

  x
}
