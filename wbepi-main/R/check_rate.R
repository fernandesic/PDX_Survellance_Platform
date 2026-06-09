#' Check validity of a rate
#'
#' Internal function used in input checking.
#'
#' @author Thibaut Jombart
#'
#' @noRd
#'
#' @param x an atomic object to be checked
#' 

check_rate <- function(x) {

  stopifnot(
    is.numeric(x),
    length(x) == 1L,
    is.finite(x),
    x >= 0
  )

  invisible(NULL)
}



#' Vectorized version of check_rate
#'
#' @author Thibaut Jombart
#' 
#' @noRd
#'
#' @param x a vector to be checked
#'

check_rates <- function(x) {

  stopifnot(
    all(is.numeric(x)),
    all(is.finite(x)),
    all(x >= 0)
  )

  invisible(NULL)
}
